"use server";

import { redirect } from "next/navigation";

import { rentalHours, saoPauloTime, todayInSaoPaulo, type BookingDatesError } from "@/lib/booking";
import { JETBOARD_MIN_AGE } from "@/lib/equipment";
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
  error?:
    | BookingDatesError
    | "unavailable"
    | "datesUnavailable"
    | "identityRequired"
    | "birthDateRequired"
    | "birthDateInvalid"
    | "tooYoung"
    | "tooShort"
    | "timeInvalid"
    | "outsideHours"
    | "timesTaken"
    | CouponError;
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
 * Cupom digitado no quadro de reserva (decisões de 20/10/2026): o banco confere
 * cidade, validade e limites. O cupom deixa o aluguel grátis ou dá x% de
 * desconto no aluguel e y% na taxa.
 */
export type CouponPreview = { kind: "free" | "discount"; rentalPercent: number; feePercent: number };

export async function checkCoupon(
  equipmentId: string,
  code: string,
  pickup: string,
  dropoff: string,
): Promise<({ ok: true } & CouponPreview) | { ok: false; error: CouponError }> {
  const coupon = cleanCoupon(code);
  if (!/^[A-Z0-9]{3,30}$/.test(coupon)) return { ok: false, error: "couponInvalid" };
  if (!supabaseConfigured()) {
    if (coupon === "DEMO10") return { ok: true, kind: "discount", rentalPercent: 10, feePercent: 20 };
    return DEMO_COUPONS.includes(coupon) ? { ok: true, kind: "free", rentalPercent: 100, feePercent: 100 } : { ok: false, error: "couponInvalid" };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("coupon_preview", {
    p_code: coupon,
    p_equipment: equipmentId,
    p_start: pickup || null,
    p_end: dropoff || null,
  });
  const row = (data as { kind: string; rental_percent: number; fee_percent: number }[] | null)?.[0];
  if (error || !row) return { ok: false, error: COUPON_ERRORS[error?.message ?? ""] ?? "couponInvalid" };
  return row.kind === "discount"
    ? { ok: true, kind: "discount", rentalPercent: row.rental_percent, feePercent: row.fee_percent }
    : { ok: true, kind: "free", rentalPercent: 100, feePercent: 100 };
}

export async function requestBooking(
  equipmentId: string,
  _prev: BookingRequestState,
  formData: FormData,
): Promise<BookingRequestState> {
  const equipment = await getEquipment(equipmentId);
  if (!equipment || !equipment.is_available) return { error: "unavailable" };

  // Dia e hora de retirada e de devolução (decisões de 20/10/2026).
  const pickup = String(formData.get("pickup_date") ?? "");
  const dropoff = String(formData.get("return_date") ?? "");
  const pickupTime = String(formData.get("pickup_time") ?? "");
  const returnTime = String(formData.get("return_time") ?? "");
  const DATE = /^\d{4}-\d{2}-\d{2}$/;
  const TIME = /^([01]\d|2[0-3]):(00|30)$/;
  if (!DATE.test(pickup) || !TIME.test(pickupTime)) return { error: "pickupRequired" };
  if (!DATE.test(dropoff) || !TIME.test(returnTime)) return { error: "returnRequired" };
  if (saoPauloTime(pickup, pickupTime) < Date.now()) return { error: "pickupInPast" };
  const hours = rentalHours(pickup, pickupTime, dropoff, returnTime);
  if (hours <= 0) return { error: "returnBeforePickup" };
  if (hours < 1) return { error: "tooShort" };

  const coupon = cleanCoupon(formData.get("coupon"));
  // Jetboard (decisão de 22/10/2026): só maiores de 21 anos. A data de nascimento
  // vem na primeira reserva de jetboard; o banco confere a idade.
  const birthDate = String(formData.get("birth_date") ?? "");
  if (equipment.type === "jetboard" && formData.has("birth_date")) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return { error: "birthDateRequired" };
    // Na demonstração (sem banco), confere aqui: nascido depois de "hoje menos 21 anos" é menor.
    const today = todayInSaoPaulo();
    const limit = `${Number(today.slice(0, 4)) - JETBOARD_MIN_AGE}${today.slice(4)}`;
    if (!supabaseConfigured() && birthDate > limit) return { error: "tooYoung" };
  }

  // O valor é sempre calculado pelo banco (diária e horas), nunca vem do navegador.
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");
    if (equipment.type === "jetboard" && birthDate) {
      const { error: bornError } = await supabase.rpc("set_birth_date", { p_date: birthDate });
      if (bornError && bornError.message !== "birth_date_locked") return { error: "birthDateInvalid" };
    }
    const { error } = await supabase.rpc("request_booking", {
      p_equipment: equipmentId,
      p_start: pickup,
      p_start_time: pickupTime,
      p_end: dropoff,
      p_end_time: returnTime,
      p_coupon: coupon || null,
    });
    if (error) {
      if (COUPON_ERRORS[error.message]) return { error: COUPON_ERRORS[error.message] };
      const known = {
        dates_unavailable: "datesUnavailable",
        pickup_in_past: "pickupInPast",
        return_before_pickup: "returnBeforePickup",
        identity_required: "identityRequired",
        too_short: "tooShort",
        time_invalid: "timeInvalid",
        outside_hours: "outsideHours",
        times_taken: "timesTaken",
        birth_date_required: "birthDateRequired",
        too_young: "tooYoung",
      } as const;
      return { error: known[error.message as keyof typeof known] ?? "unavailable" };
    }
    const { data: made } = await supabase.from("bookings").select("free").eq("rider_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { done: true, free: Boolean(coupon && made?.free) };
  }
  if (coupon && !DEMO_COUPONS.includes(coupon) && coupon !== "DEMO10") return { error: "couponInvalid" };
  return { done: true, free: DEMO_COUPONS.includes(coupon) };
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
