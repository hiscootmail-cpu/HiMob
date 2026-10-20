"use server";

import { redirect } from "next/navigation";

import { unavailableDays } from "@/lib/availability";
import { firstConflict, todayInSaoPaulo, validateBookingDates, type BookingDatesError } from "@/lib/booking";
import { getEquipment } from "@/lib/equipment-db";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Pedido de reserva. Com a Supabase, a função do banco confere de novo se a
 * pessoa está conectada, se não é dona do anúncio, se o cadastro não está
 * bloqueado e se os dias estão livres, e guarda o preço do anúncio.
 * Sem a Supabase (demonstração): confere os dados e simula a resposta.
 * Dias já reservados e dias bloqueados pelo Host já são recusados aqui.
 */

export type CouponError = "couponInvalid" | "couponCity" | "couponUsedUp" | "couponAlreadyUsed" | "couponDays";

export type BookingRequestState = {
  error?: BookingDatesError | "unavailable" | "datesUnavailable" | "identityRequired" | CouponError;
  done?: boolean;
  /** Pedido feito com cupom de aluguel grátis (ação da Hi Scoot). */
  free?: boolean;
};

const COUPON_ERRORS: Record<string, CouponError> = {
  coupon_invalid: "couponInvalid",
  coupon_city: "couponCity",
  coupon_used_up: "couponUsedUp",
  coupon_already_used: "couponAlreadyUsed",
  coupon_days: "couponDays",
};

/** Cupons da demonstração (sem Supabase), só para conferir a tela. */
const DEMO_COUPONS = ["SCOOTEMMOGI", "SCOOTEMJAGUA", "SCOOTEMSAMPA"];

const cleanCoupon = (value: FormDataEntryValue | string | null) =>
  String(value ?? "").replace(/\s/g, "").toUpperCase().slice(0, 30);

/**
 * Cupom digitado no quadro de reserva (decisão de 20/10/2026): o banco confere
 * cidade, validade e limites. Por enquanto todo cupom deixa o aluguel grátis.
 */
export async function checkCoupon(
  equipmentId: string,
  code: string,
  pickup: string,
  dropoff: string,
): Promise<{ ok: true } | { ok: false; error: CouponError }> {
  const coupon = cleanCoupon(code);
  if (!/^[A-Z0-9]{3,30}$/.test(coupon)) return { ok: false, error: "couponInvalid" };
  if (!supabaseConfigured()) return DEMO_COUPONS.includes(coupon) ? { ok: true } : { ok: false, error: "couponInvalid" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_coupon", {
    p_code: coupon,
    p_equipment: equipmentId,
    p_start: pickup || null,
    p_end: dropoff || null,
  });
  return error ? { ok: false, error: COUPON_ERRORS[error.message] ?? "couponInvalid" } : { ok: true };
}

export async function requestBooking(
  equipmentId: string,
  _prev: BookingRequestState,
  formData: FormData,
): Promise<BookingRequestState> {
  const equipment = await getEquipment(equipmentId);
  if (!equipment || !equipment.is_available) return { error: "unavailable" };

  const pickup = String(formData.get("pickup") ?? "");
  const dropoff = String(formData.get("return") ?? "");
  const error = validateBookingDates(pickup, dropoff, todayInSaoPaulo());
  if (error) return { error };

  const { booked, blocked } = await unavailableDays(equipmentId);
  if (firstConflict(pickup, dropoff, [...booked, ...blocked])) return { error: "datesUnavailable" };

  const coupon = cleanCoupon(formData.get("coupon"));

  // O valor é sempre recalculado no servidor (diárias x daily_price), nunca vem do navegador.
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");
    const { error } = await supabase.rpc("request_booking", {
      p_equipment: equipmentId,
      p_start: pickup,
      p_end: dropoff,
      p_coupon: coupon || null,
    });
    if (error) {
      if (COUPON_ERRORS[error.message]) return { error: COUPON_ERRORS[error.message] };
      const known = {
        dates_unavailable: "datesUnavailable",
        pickup_in_past: "pickupInPast",
        return_before_pickup: "returnBeforePickup",
        identity_required: "identityRequired",
      } as const;
      return { error: known[error.message as keyof typeof known] ?? "unavailable" };
    }
    return { done: true, free: Boolean(coupon) };
  }
  if (coupon && !DEMO_COUPONS.includes(coupon)) return { error: "couponInvalid" };
  return { done: true, free: Boolean(coupon) };
}

export type WaitlistState = { onWaitlist: boolean };

/**
 * "Avisar quando disponível" e "Cancelar aviso" alternam a mesma lista de espera.
 * Quando o Host marca disponível de novo, o banco avisa e tira a pessoa da lista.
 */
export async function toggleWaitlist(equipmentId: string, prev: WaitlistState): Promise<WaitlistState> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");
    const { error } = prev.onWaitlist
      ? await supabase.from("waitlist").delete().eq("equipment_id", equipmentId).eq("user_id", user.id)
      : await supabase.from("waitlist").insert({ equipment_id: equipmentId, user_id: user.id });
    if (error) return prev;
  }
  return { onWaitlist: !prev.onWaitlist };
}

/** "Falar com o Host": cria ou reaproveita a conversa e abre o chat. */
export async function startConversation(equipmentId: string) {
  redirect(`/conversations/${equipmentId}`);
}
