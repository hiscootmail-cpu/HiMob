"use server";

import { revalidatePath } from "next/cache";

import { BLOCKING_STATUSES, setBlockedDay, unavailableDays } from "@/lib/availability";
import { firstConflict, todayInSaoPaulo } from "@/lib/booking";
import { REVIEW_COMMENT_MAX } from "@/lib/bookings";
import { hostCancelPolicy } from "@/lib/cancellation";
import { validatePhoto, type HandoffError, type HandoffKind } from "@/lib/handoff";
import { getHostBooking, getHostListing, listHostBookings } from "@/lib/host";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Com a Supabase: as funções do banco conferem de novo o dono e as regras
 * antes de gravar (etapa 4). Nenhum valor é cobrado ou devolvido ainda
 * (entra com o Mercado Pago).
 * Sem a Supabase (demonstração): conferem os dados e simulam a resposta.
 */

/** Caminho de foto enviado pelo navegador: só da pasta da própria pessoa. */
async function ownPhotoPath(formData: FormData): Promise<string | null> {
  const path = String(formData.get("photo_path") ?? "");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user && path.startsWith(`${user.id}/`) ? path : null;
}

export type DecisionState = { done?: "accepted" | "rejected"; error?: "notAllowed" | "datesTaken" };

/** Pedido novo: Aceitar ou Recusar. */
export async function decideBooking(bookingId: string, decision: "accept" | "reject"): Promise<DecisionState> {
  const booking = await getHostBooking(bookingId);
  if (!booking || booking.status !== "pending") return { error: "notAllowed" };
  if (decision === "accept") {
    // Não aceita pedido em dias que já foram reservados ou bloqueados.
    const { booked, blocked } = await unavailableDays(booking.equipment.id);
    if (firstConflict(booking.start_date, booking.end_date, [...booked, ...blocked])) return { error: "datesTaken" };
  }
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("decide_booking", { p_id: bookingId, p_accept: decision === "accept" });
    if (error) return { error: error.message === "dates_taken" ? "datesTaken" : "notAllowed" };
    revalidatePath("/host/reservations");
  }
  return { done: decision === "accept" ? "accepted" : "rejected" };
}

export type HostCancelState = { done?: boolean; error?: "notAllowed" };

/** Cancelar pelo Host: até 24 h antes da retirada (lib/cancellation.ts). */
export async function hostCancelBooking(bookingId: string): Promise<HostCancelState> {
  const booking = await getHostBooking(bookingId);
  if (!booking || !hostCancelPolicy(booking).allowed) return { error: "notAllowed" };
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_booking", { p_id: bookingId });
    if (error) return { error: "notAllowed" };
    revalidatePath("/host/reservations");
  }
  return { done: true };
}

export type HostHandoffState = { error?: HandoffError; done?: boolean };

/** Confirmar retirada ou devolução com foto obrigatória (inventário de ações). */
export async function hostConfirmHandoff(
  bookingId: string,
  kind: HandoffKind,
  _prev: HostHandoffState,
  formData: FormData,
): Promise<HostHandoffState> {
  const booking = await getHostBooking(bookingId);
  const expected = kind === "pickup" ? "confirmed" : "active";
  if (!booking || booking.status !== expected) return { error: "wrongStatus" };

  if (supabaseConfigured()) {
    // A foto já foi enviada pelo navegador direto para a pasta da pessoa.
    const path = await ownPhotoPath(formData);
    if (!path) return { error: "photoRequired" };
    const supabase = await createClient();
    const { error } = await supabase.rpc("confirm_handoff", { p_id: bookingId, p_kind: kind, p_photo: path });
    if (error) return { error: error.message === "wrong_status" ? "wrongStatus" : "photoRequired" };
    revalidatePath("/host/reservations");
    return { done: true };
  }

  const photo = formData.get("photo");
  const error = validatePhoto(photo instanceof File ? photo : null);
  if (error) return { error };
  return { done: true };
}

export type RiderReviewState = { errors?: { rating?: "ratingRequired"; comment?: "commentTooLong" }; done?: boolean };

/** Avaliar o Rider: 1 a 5 estrelas + comentário (inventário de ações). */
export async function reviewRider(bookingId: string, _prev: RiderReviewState, formData: FormData): Promise<RiderReviewState> {
  const booking = await getHostBooking(bookingId);
  if (!booking || booking.status !== "completed" || booking.host_reviewed) return { done: false };

  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();
  const errors = {
    rating: Number.isInteger(rating) && rating >= 1 && rating <= 5 ? undefined : ("ratingRequired" as const),
    comment: comment.length > REVIEW_COMMENT_MAX ? ("commentTooLong" as const) : undefined,
  };
  if (errors.rating || errors.comment) return { errors };
  return { done: true };
}

export type BlockDayState = { blocked?: boolean; error?: "notAllowed" | "booked" };

/**
 * Bloquear ou desbloquear um dia no calendário (decisão de 09/10/2026).
 * Só anúncio publicado, só de hoje em diante, e dia já reservado não muda
 * (ele já está bloqueado pela reserva).
 */
export async function toggleBlockedDay(equipmentId: string, day: string, blocked: boolean): Promise<BlockDayState> {
  const listing = await getHostListing(equipmentId);
  if (!listing || listing.review_status !== "approved") return { error: "notAllowed" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < todayInSaoPaulo()) return { error: "notAllowed" };

  const bookings = await listHostBookings();
  const isBooked = bookings.some(
    (b) => b.equipment.id === equipmentId && BLOCKING_STATUSES.includes(b.status) && b.start_date <= day && day <= b.end_date,
  );
  if (isBooked) return { error: "booked" };

  const result = await setBlockedDay(equipmentId, day, blocked);
  if (result === null) return { error: "notAllowed" };
  revalidatePath("/host/reservations");
  revalidatePath(`/equipment/${equipmentId}`);
  return { blocked: result };
}
