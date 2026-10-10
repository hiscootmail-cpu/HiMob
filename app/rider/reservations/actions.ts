"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { REVIEW_COMMENT_MAX } from "@/lib/bookings";
import { getRiderBooking } from "@/lib/bookings-db";
import { riderCancelPolicy } from "@/lib/cancellation";
import { exampleEquipmentCode, normalizeCode, validatePhoto, type HandoffError, type HandoffKind } from "@/lib/handoff";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Com a Supabase: as funções do banco conferem de novo se a reserva é da
 * pessoa conectada e as regras antes de gravar (etapa 4).
 * PROVISÓRIO: o pagamento é de teste e não cobra nada (decisão de 10/10/2026)
 * até o Mercado Pago entrar.
 * Sem a Supabase (demonstração): conferem os dados e simulam a resposta.
 */

export type CancelState = { done?: boolean; error?: "notAllowed" };

export async function cancelBooking(bookingId: string): Promise<CancelState> {
  const booking = await getRiderBooking(bookingId);
  // Regra conferida no servidor: até 24 h antes da retirada (lib/cancellation.ts).
  if (!booking || !riderCancelPolicy(booking).allowed) return { error: "notAllowed" };
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_booking", { p_id: bookingId });
    if (error) return { error: "notAllowed" };
    revalidatePath("/rider/reservations");
  }
  return { done: true };
}

export type PaymentMethod = "pix" | "card";
export type PaymentState = { error?: "methodRequired" | "notAllowed" };

/**
 * Pagamento pelo Mercado Pago (PIX ou cartão), com repasse automático ao Host (split).
 * O valor é sempre recalculado no servidor a partir da reserva; nunca vem do navegador.
 * Os dados do cartão são digitados no formulário seguro do Mercado Pago: a Hi Scoot
 * nunca recebe nem guarda o número do cartão.
 */
export async function payBooking(bookingId: string, _prev: PaymentState, formData: FormData): Promise<PaymentState> {
  const booking = await getRiderBooking(bookingId);
  if (!booking || booking.status !== "accepted") return { error: "notAllowed" };

  const method = formData.get("method");
  if (method !== "pix" && method !== "card") return { error: "methodRequired" };

  if (supabaseConfigured()) {
    // PROVISÓRIO: pagamento de teste. Sai quando o Mercado Pago entrar.
    const supabase = await createClient();
    const { error } = await supabase.rpc("pay_booking_test", { p_id: bookingId });
    if (error) return { error: "notAllowed" };
  }
  redirect(`/rider/reservations/${bookingId}/confirmed`);
}

export type HandoffState = { errors?: { code?: HandoffError; photo?: HandoffError }; done?: boolean };

/** Confirmar retirada ou devolução: código do QR + foto do equipamento. */
export async function confirmHandoff(
  bookingId: string,
  kind: HandoffKind,
  _prev: HandoffState,
  formData: FormData,
): Promise<HandoffState> {
  const booking = await getRiderBooking(bookingId);
  const expectedStatus = kind === "pickup" ? "confirmed" : "active";
  if (!booking || booking.status !== expectedStatus) return { errors: { code: "wrongStatus" } };

  const code = normalizeCode(String(formData.get("code") ?? ""));

  if (supabaseConfigured()) {
    // A foto já foi enviada pelo navegador direto para a pasta da pessoa;
    // o banco confere o código da etiqueta e se a foto existe.
    if (!code) return { errors: { code: "codeRequired" } };
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const path = String(formData.get("photo_path") ?? "");
    if (!user || !path.startsWith(`${user.id}/`)) return { errors: { photo: "photoRequired" } };
    const { error } = await supabase.rpc("confirm_handoff", { p_id: bookingId, p_kind: kind, p_photo: path, p_code: code });
    if (error) {
      if (error.message === "code_invalid") return { errors: { code: "codeInvalid" } };
      if (error.message === "photo_required") return { errors: { photo: "photoRequired" } };
      return { errors: { code: "wrongStatus" } };
    }
    revalidatePath("/rider/reservations");
    return { done: true };
  }

  const photo = formData.get("photo");
  const errors = {
    code: !code ? ("codeRequired" as const) : code !== exampleEquipmentCode(booking.equipment.id) ? ("codeInvalid" as const) : undefined,
    photo: validatePhoto(photo instanceof File ? photo : null) ?? undefined,
  };
  if (errors.code || errors.photo) return { errors };

  return { done: true };
}

export type ReviewState = {
  errors?: { equipment?: "ratingRequired"; host?: "ratingRequired"; comment?: "commentTooLong" };
  done?: boolean;
};

/** Avaliação do Rider: nota do equipamento e nota do Host (1 a 5) + comentário opcional. */
export async function submitReview(bookingId: string, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  const booking = await getRiderBooking(bookingId);
  if (!booking || booking.status !== "completed" || booking.rider_reviewed) return { done: false };

  const rating = (name: string) => {
    const value = Number(formData.get(name));
    return Number.isInteger(value) && value >= 1 && value <= 5 ? value : null;
  };
  const comment = String(formData.get("comment") ?? "").trim();
  const errors = {
    equipment: rating("equipmentRating") ? undefined : ("ratingRequired" as const),
    host: rating("hostRating") ? undefined : ("ratingRequired" as const),
    comment: comment.length > REVIEW_COMMENT_MAX ? ("commentTooLong" as const) : undefined,
  };
  if (errors.equipment || errors.host || errors.comment) return { errors };

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("submit_review", {
      p_booking: bookingId,
      p_rating: rating("hostRating"),
      p_equipment_rating: rating("equipmentRating"),
      p_comment: comment,
    });
    if (error) return { done: false };
    revalidatePath("/rider/reservations");
  }
  return { done: true };
}
