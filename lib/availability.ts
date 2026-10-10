import { daysBetween } from "@/lib/booking";
import type { BookingStatus } from "@/lib/bookings";
import { exampleBlockedDays } from "@/lib/mock/availability";
import { exampleBookings } from "@/lib/mock/bookings";
import { exampleHostBookings } from "@/lib/mock/host";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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
 * Com a Supabase: o banco junta dias reservados e bloqueados (função
 * "unavailable_days"). Sem a Supabase (demonstração): lê os exemplos.
 */
export async function unavailableDays(equipmentId: string): Promise<Unavailable> {
  if (supabaseConfigured()) {
    if (!/^[0-9a-f-]{36}$/i.test(equipmentId)) return { booked: [], blocked: [] };
    const supabase = await createClient();
    const { data } = await supabase.rpc("unavailable_days", { eq: equipmentId });
    const rows = (data ?? []) as { day: string; kind: "booked" | "blocked" }[];
    return {
      booked: rows.filter((d) => d.kind === "booked").map((d) => d.day),
      blocked: rows.filter((d) => d.kind === "blocked").map((d) => d.day),
    };
  }
  const booked = new Set<string>();
  for (const booking of [...exampleBookings, ...exampleHostBookings]) {
    if (booking.equipment.id !== equipmentId || !BLOCKING_STATUSES.includes(booking.status)) continue;
    daysBetween(booking.start_date, booking.end_date).forEach((day) => booked.add(day));
  }
  const blocked = [...(exampleBlockedDays.get(equipmentId) ?? [])].filter((day) => !booked.has(day));
  return { booked: [...booked].sort(), blocked: blocked.sort() };
}

/**
 * Bloquear ou desbloquear um dia (Host). Devolve se o dia ficou bloqueado,
 * ou null se o banco recusou (o banco confere o dono e se o dia já está reservado).
 */
export async function setBlockedDay(equipmentId: string, day: string, blocked: boolean): Promise<boolean | null> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = blocked
      ? await supabase.from("blocked_days").upsert({ equipment_id: equipmentId, day }, { ignoreDuplicates: true })
      : await supabase.from("blocked_days").delete().eq("equipment_id", equipmentId).eq("day", day);
    return error ? null : blocked;
  }
  const days = exampleBlockedDays.get(equipmentId) ?? new Set<string>();
  if (blocked) days.add(day);
  else days.delete(day);
  exampleBlockedDays.set(equipmentId, days);
  return blocked;
}
