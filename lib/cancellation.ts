import type { Booking } from "@/lib/bookings";
import { bookingPrice } from "@/lib/bookings";

/*
 * Regra de cancelamento (decisões de 09/10/2026):
 * - Pode cancelar até 24 horas antes do horário de retirada definido pelo Host.
 * - Quem cancela fica com a taxa da plataforma (15%):
 *   - Rider cancela uma reserva paga: recebe de volta o valor das diárias;
 *     a taxa não é devolvida.
 *   - Host cancela (área do Host): o Rider recebe tudo de volta (diárias + taxa)
 *     e a taxa é cobrada do Host.
 * - Antes do pagamento nada foi cobrado, então cancelar não tem custo.
 *
 * Horários em Brasília (UTC-3; o Brasil não tem horário de verão desde 2019).
 */

export const CANCEL_HOURS_BEFORE = 24;
const BRASILIA_OFFSET = "-03:00";
const HOUR_MS = 60 * 60 * 1000;

/** Situações em que já houve pagamento. */
const PAID = new Set(["confirmed"]);
/** Situações em que ainda não houve pagamento. */
const UNPAID = new Set(["pending", "accepted"]);

/** Momento da retirada (data da reserva + horário do Host). */
export function pickupMoment(booking: Pick<Booking, "start_date" | "pickup_time">): Date {
  return new Date(`${booking.start_date}T${booking.pickup_time}:00${BRASILIA_OFFSET}`);
}

/** Último momento em que uma reserva paga ainda pode ser cancelada. */
export function cancelDeadline(booking: Pick<Booking, "start_date" | "pickup_time">): Date {
  return new Date(pickupMoment(booking).getTime() - CANCEL_HOURS_BEFORE * HOUR_MS);
}

export type CancelPolicy =
  | { allowed: true; paid: false }
  | { allowed: true; paid: true; refund: number; fee: number; deadline: Date }
  | { allowed: false; reason: "deadlinePassed" | "notCancellable"; deadline?: Date };

export function riderCancelPolicy(booking: Booking, now: Date = new Date()): CancelPolicy {
  if (UNPAID.has(booking.status)) return { allowed: true, paid: false };
  if (!PAID.has(booking.status)) return { allowed: false, reason: "notCancellable" };

  const deadline = cancelDeadline(booking);
  if (now.getTime() > deadline.getTime()) return { allowed: false, reason: "deadlinePassed", deadline };

  const price = bookingPrice(booking);
  return { allowed: true, paid: true, refund: price.subtotal, fee: price.fee, deadline };
}
