"use server";

import { redirect } from "next/navigation";

import { getRiderBooking, REVIEW_COMMENT_MAX } from "@/lib/bookings";
import { riderCancelPolicy } from "@/lib/cancellation";
import { exampleEquipmentCode, normalizeCode, validatePhoto, type HandoffError, type HandoffKind } from "@/lib/handoff";

/*
 * PROVISÓRIO: nada é gravado e nenhum pagamento é cobrado ainda.
 * As ações conferem os dados no servidor e simulam a resposta.
 * Quando o Supabase e o Mercado Pago entrarem, o servidor também confere se a
 * reserva é da pessoa conectada antes de qualquer ação.
 */

export type CancelState = { done?: boolean; error?: "notAllowed" };

export async function cancelBooking(bookingId: string): Promise<CancelState> {
  const booking = await getRiderBooking(bookingId);
  // Regra conferida no servidor: até 24 h antes da retirada (lib/cancellation.ts).
  if (!booking || !riderCancelPolicy(booking).allowed) return { error: "notAllowed" };
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

  return { done: true };
}
