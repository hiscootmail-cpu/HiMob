import "server-only";

import { randomUUID } from "node:crypto";

import type { Booking } from "@/lib/bookings";
import {
  accessTokenFor,
  createMpPayment,
  mercadoPagoOn,
  mercadoPagoServerReady,
  refundMpPayment,
  syncPayment,
} from "@/lib/mercadopago/server";
import { cancelRefund, methodEnabled, paymentSplit, type PaymentMethod } from "@/lib/payment-split";
import { siteOrigin } from "@/lib/site-origin";
import { createClient, createSecretClient } from "@/lib/supabase/server";

/*
 * Pagamento e devolução de uma reserva com o Mercado Pago (decisões de 19/10/2026).
 * O valor é sempre recalculado aqui, a partir da reserva guardada no banco;
 * o navegador só manda o meio de pagamento e o "token" do cartão gerado pelo
 * formulário seguro do Mercado Pago (a Hi Scoot nunca vê o número do cartão).
 */

/** O que o formulário seguro do Mercado Pago (Payment Brick) entrega. */
export type BrickFormData = {
  payment_method_id?: string;
  token?: string;
  issuer_id?: string | number;
  installments?: number;
  payer?: { email?: string; identification?: { type?: string; number?: string } };
};

export type PixData = { code: string; qr: string };

export type PaymentResult =
  | { status: "approved" }
  | { status: "pending"; pix?: PixData }
  | { status: "rejected" }
  | { status: "error"; error: "notAllowed" | "unavailable" };

/** PIX vence em 30 minutos (horário de Brasília, formato pedido pelo Mercado Pago). */
export function pixExpiration() {
  const date = new Date(Date.now() + 30 * 60 * 1000 - 3 * 3600 * 1000);
  return `${date.toISOString().slice(0, 23)}-03:00`;
}

/** PIX que ainda está esperando pagamento (para não criar outro igual). */
export async function pendingPix(bookingId: string): Promise<PixData | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("pix_code, pix_qr_base64, status, created_at")
    .eq("booking_id", bookingId)
    .eq("method", "pix")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.pix_code || Date.now() - new Date(data.created_at).getTime() > 30 * 60 * 1000) return null;
  return { code: data.pix_code, qr: data.pix_qr_base64 ?? "" };
}

export async function payBookingWithMercadoPago(
  booking: Booking,
  hostId: string,
  payerEmail: string,
  form: BrickFormData,
): Promise<PaymentResult> {
  if (booking.status !== "accepted") return { status: "error", error: "notAllowed" };
  if (!mercadoPagoServerReady() || !(await mercadoPagoOn())) return { status: "error", error: "unavailable" };

  const method: PaymentMethod = form.payment_method_id === "pix" ? "pix" : "card";
  if (!methodEnabled(method)) return { status: "error", error: "unavailable" };
  if (method === "card" && (!form.token || Number(form.installments ?? 1) !== 1)) return { status: "error", error: "notAllowed" };

  if (method === "pix") {
    const existing = await pendingPix(booking.id);
    if (existing) return { status: "pending", pix: existing };
  }

  const admin = createSecretClient();
  const hostToken = await accessTokenFor(hostId);
  if (!admin || !hostToken) return { status: "error", error: "unavailable" };
  const { data: debt } = await admin.rpc("host_pending_debt", { p_host: hostId });
  const split = paymentSplit(booking.days, booking.host_daily_price, method, Number(debt ?? 0));

  const body: Record<string, unknown> = {
    transaction_amount: split.total,
    application_fee: split.applicationFee,
    description: `Hi Scoot · ${booking.equipment.title}`.slice(0, 120),
    external_reference: booking.id,
    notification_url: `${await siteOrigin()}/api/mercado-pago/webhook`,
    statement_descriptor: "HISCOOT",
    payment_method_id: method === "pix" ? "pix" : form.payment_method_id,
    payer: {
      email: form.payer?.email || payerEmail,
      ...(form.payer?.identification?.number ? { identification: form.payer.identification } : {}),
    },
    ...(method === "pix"
      ? { date_of_expiration: pixExpiration() }
      : { token: form.token, installments: 1, ...(form.issuer_id ? { issuer_id: String(form.issuer_id) } : {}) }),
  };

  const { ok, data } = await createMpPayment(hostToken, body, randomUUID());
  if (!ok || !data?.id) return { status: "rejected" };

  const pix = data.point_of_interaction?.transaction_data;
  const { data: row } = await admin
    .from("payments")
    .insert({
      booking_id: booking.id,
      mp_payment_id: String(data.id),
      method,
      status: data.status,
      amount: split.total,
      application_fee: split.applicationFee,
      debt_included: split.debtIncluded,
      pix_code: pix?.qr_code ?? null,
      pix_qr_base64: pix?.qr_code_base64 ?? null,
    })
    .select("id")
    .single();

  if (data.status === "approved") {
    if (row) await admin.rpc("confirm_payment", { p_payment: row.id });
    return { status: "approved" };
  }
  if (data.status === "rejected" || data.status === "cancelled") return { status: "rejected" };
  return { status: "pending", pix: pix?.qr_code ? { code: pix.qr_code, qr: pix.qr_code_base64 ?? "" } : undefined };
}

/** Tela do PIX pergunta de tempos em tempos: já pagou? */
export async function checkBookingPayment(bookingId: string): Promise<"approved" | "pending" | "rejected"> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("payments")
    .select("mp_payment_id, status")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.mp_payment_id) return "pending";
  if (data.status === "approved") return "approved";
  return (await syncPayment(data.mp_payment_id)) ?? "pending";
}

/**
 * Cancelar reserva paga com o Mercado Pago ligado: o banco confere quem pode
 * (e o prazo), o Mercado Pago devolve o dinheiro e só então o cancelamento é
 * registrado (com a taxa pendente do Host, quando houver).
 */
export async function cancelPaidBooking(booking: Booking, hostId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: who, error } = await supabase.rpc("cancel_check", { p_id: booking.id });
  if (error || (who !== "rider" && who !== "host")) return false;

  const admin = createSecretClient();
  const hostToken = await accessTokenFor(hostId);
  if (!admin || !hostToken) return false;
  const { data: payment } = await admin
    .from("payments")
    .select("mp_payment_id")
    .eq("booking_id", booking.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!payment?.mp_payment_id) return false;

  const { refund, hostDebt } = cancelRefund(who, booking.days, booking.host_daily_price);
  const refunded = await refundMpPayment(hostToken, payment.mp_payment_id, refund, `refund-${booking.id}`);
  if (!refunded.ok) return false;
  const { error: saveError } = await admin.rpc("cancel_paid_booking", {
    p_id: booking.id,
    p_who: who,
    p_refunded: refund,
    p_host_debt: hostDebt,
  });
  return !saveError;
}
