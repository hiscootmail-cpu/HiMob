import { addDays, todayInSaoPaulo } from "@/lib/booking";
import type { Booking } from "@/lib/bookings";
import { bookingPrice } from "@/lib/bookings";

/*
 * Regra de cancelamento (decisão de 09/10/2026):
 * - Pode cancelar até 24 horas antes da retirada.
 * - Quem cancela fica com a taxa da plataforma (15%):
 *   - Rider cancela uma reserva paga: recebe de volta o valor das diárias;
 *     a taxa não é devolvida.
 *   - Host cancela (área do Host, Lote 5): o Rider recebe tudo de volta e a
 *     taxa é cobrada do Host.
 * - Antes do pagamento nada foi cobrado, então cancelar não tem custo.
 *
 * Como a reserva ainda não tem horário de retirada (só a data), "24 horas antes"
 * conta a partir do começo do dia da retirada: o último dia inteiro para
 * cancelar é 2 dias antes da retirada (ex.: retirada dia 15 → até o fim do dia 13).
 * EM ABERTO: se a reserva ganhar horário, o prazo passa a ser exato em horas.
 */

export const CANCEL_HOURS_BEFORE = 24;

/** Situações em que já houve pagamento. */
const PAID = new Set(["confirmed"]);
/** Situações em que ainda não houve pagamento. */
const UNPAID = new Set(["pending", "accepted"]);

/** Último dia (AAAA-MM-DD) em que uma reserva paga ainda pode ser cancelada. */
export function lastCancelDay(startDate: string): string {
  return addDays(startDate, -2);
}

export type CancelPolicy =
  | { allowed: true; paid: false }
  | { allowed: true; paid: true; refund: number; fee: number; lastDay: string }
  | { allowed: false; reason: "deadlinePassed" | "notCancellable"; lastDay?: string };

export function riderCancelPolicy(booking: Booking, today = todayInSaoPaulo()): CancelPolicy {
  if (UNPAID.has(booking.status)) return { allowed: true, paid: false };
  if (!PAID.has(booking.status)) return { allowed: false, reason: "notCancellable" };

  const lastDay = lastCancelDay(booking.start_date);
  if (today > lastDay) return { allowed: false, reason: "deadlinePassed", lastDay };

  const price = bookingPrice(booking);
  return { allowed: true, paid: true, refund: price.subtotal, fee: price.fee, lastDay };
}
