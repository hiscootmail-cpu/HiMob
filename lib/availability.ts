import { daysBetween } from "@/lib/booking";
import type { BookingStatus } from "@/lib/bookings";
import { exampleBlockedDays } from "@/lib/mock/availability";
import { exampleBookings } from "@/lib/mock/bookings";
import { exampleHostBookings } from "@/lib/mock/host";

/*
 * Dias livres de cada equipamento (decisão de 09/10/2026).
 *
 * Um dia fica fora da reserva quando:
 * - já está reservado: reserva aceita, paga ou em uso ocupa do dia da
 *   retirada até o dia da devolução, incluindo os dois;
 * - o Host bloqueou o dia no calendário dele.
 *
 * Pedido novo (ainda não aceito) não bloqueia o dia.
 * O servidor sempre confere de novo antes de aceitar um pedido.
 */

export const BLOCKING_STATUSES: BookingStatus[] = ["accepted", "confirmed", "active"];

export type Unavailable = {
  /** Dias ocupados por reservas. */
  booked: string[];
  /** Dias bloqueados pelo Host. */
  blocked: string[];
};

/*
 * PROVISÓRIO: lê os exemplos. Com o Supabase, uma consulta junta as reservas
 * e a tabela de dias bloqueados do equipamento.
 */
export async function unavailableDays(equipmentId: string): Promise<Unavailable> {
  const booked = new Set<string>();
  for (const booking of [...exampleBookings, ...exampleHostBookings]) {
    if (booking.equipment.id !== equipmentId || !BLOCKING_STATUSES.includes(booking.status)) continue;
    daysBetween(booking.start_date, booking.end_date).forEach((day) => booked.add(day));
  }
  const blocked = [...(exampleBlockedDays.get(equipmentId) ?? [])].filter((day) => !booked.has(day));
  return { booked: [...booked].sort(), blocked: blocked.sort() };
}

/** Bloquear ou desbloquear um dia (Host). Devolve se o dia ficou bloqueado. */
export async function setBlockedDay(equipmentId: string, day: string, blocked: boolean): Promise<boolean> {
  const days = exampleBlockedDays.get(equipmentId) ?? new Set<string>();
  if (blocked) days.add(day);
  else days.delete(day);
  exampleBlockedDays.set(equipmentId, days);
  return blocked;
}
