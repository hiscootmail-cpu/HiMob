"use server";

import { REVIEW_COMMENT_MAX } from "@/lib/bookings";
import { hostCancelPolicy } from "@/lib/cancellation";
import { validatePhoto, type HandoffError, type HandoffKind } from "@/lib/handoff";
import { getHostBooking } from "@/lib/host";

/*
 * PROVISÓRIO: nada é gravado e nenhum valor é cobrado ou devolvido ainda.
 * As ações conferem os dados no servidor e simulam a resposta.
 */

export type DecisionState = { done?: "accepted" | "rejected"; error?: "notAllowed" };

/** Pedido novo: Aceitar ou Recusar. */
export async function decideBooking(bookingId: string, decision: "accept" | "reject"): Promise<DecisionState> {
  const booking = await getHostBooking(bookingId);
  if (!booking || booking.status !== "pending") return { error: "notAllowed" };
  return { done: decision === "accept" ? "accepted" : "rejected" };
}

export type HostCancelState = { done?: boolean; error?: "notAllowed" };

/** Cancelar pelo Host: até 24 h antes da retirada (lib/cancellation.ts). */
export async function hostCancelBooking(bookingId: string): Promise<HostCancelState> {
  const booking = await getHostBooking(bookingId);
  if (!booking || !hostCancelPolicy(booking).allowed) return { error: "notAllowed" };
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
