import type { Schedule } from "@/lib/availability-rules";
import { addDays, daysBetween, saoPauloTime } from "@/lib/booking";
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

// -----------------------------------------------------------------------------
// Dias disponíveis e horários ocupados (decisões de 20/10/2026): o Host libera
// os dias em que vai alugar; o Rider escolhe dia e hora. Um aluguel aceito
// ocupa do horário de retirada até 1 hora depois da devolução.
// -----------------------------------------------------------------------------

export { GAP_HOURS, type Schedule } from "@/lib/availability-rules";

/** Na demonstração, todo equipamento tem os próximos 60 dias liberados. */
function demoSchedule(equipmentId: string, today: string): Schedule {
  const available = Array.from({ length: 60 }, (_, i) => addDays(today, i));
  const busy = [...exampleBookings, ...exampleHostBookings]
    .filter((b) => b.equipment.id === equipmentId && BLOCKING_STATUSES.includes(b.status))
    .map((b) => ({ start: saoPauloTime(b.start_date, b.pickup_time), end: saoPauloTime(b.end_date, b.return_time) }));
  const blocked = exampleBlockedDays.get(equipmentId) ?? new Set<string>();
  return { available: available.filter((day) => !blocked.has(day)), busy };
}

/** Calendário do equipamento para o Rider (qualquer pessoa vê). */
export async function equipmentSchedule(equipmentId: string, today: string): Promise<Schedule> {
  if (!supabaseConfigured()) return demoSchedule(equipmentId, today);
  if (!/^[0-9a-f-]{36}$/i.test(equipmentId)) return { available: [], busy: [] };
  const supabase = await createClient();
  const { data } = await supabase.rpc("equipment_schedule", { eq: equipmentId });
  const rows = (data ?? []) as { kind: "available" | "busy"; day: string | null; start_at: string | null; end_at: string | null }[];
  return {
    available: rows.filter((r) => r.kind === "available" && r.day).map((r) => r.day!).sort(),
    busy: rows
      .filter((r) => r.kind === "busy" && r.start_at && r.end_at)
      .map((r) => ({ start: Date.parse(r.start_at!), end: Date.parse(r.end_at!) })),
  };
}

/** Dias liberados de um equipamento do Host (de hoje em diante). */
export async function listAvailableDays(equipmentId: string, today: string): Promise<string[]> {
  if (!supabaseConfigured()) return demoSchedule(equipmentId, today).available;
  const supabase = await createClient();
  const { data } = await supabase
    .from("equipment_available_days")
    .select("day")
    .eq("equipment_id", equipmentId)
    .gte("day", today)
    .order("day");
  return (data ?? []).map((r) => r.day as string);
}

/**
 * Liberar ou tirar vários dias de uma vez (Host). O banco confere o dono e não
 * deixa tirar dia com reserva aceita. Devolve os dias que não puderam sair.
 */
export async function setAvailableDays(equipmentId: string, days: string[], available: boolean): Promise<{ ok: boolean; kept: string[] }> {
  if (!supabaseConfigured()) return { ok: true, kept: [] };
  const supabase = await createClient();
  if (available) {
    const { error } = await supabase
      .from("equipment_available_days")
      .upsert(days.map((day) => ({ equipment_id: equipmentId, day })), { onConflict: "equipment_id,day", ignoreDuplicates: true });
    return { ok: !error, kept: [] };
  }
  // Um por um: dia com reserva aceita fica (o banco recusa).
  const kept: string[] = [];
  for (const day of days) {
    const { error } = await supabase.from("equipment_available_days").delete().eq("equipment_id", equipmentId).eq("day", day);
    if (error) kept.push(day);
  }
  return { ok: true, kept };
}

/** Dias liberados, dias com reserva aceita (estes não podem sair) e dias da semana que se repetem. */
export async function listingDays(
  equipmentId: string,
  today: string,
): Promise<{ available: string[]; booked: string[]; weekly: number[] }> {
  const [available, schedule, weekly] = await Promise.all([
    listAvailableDays(equipmentId, today),
    equipmentSchedule(equipmentId, today),
    listWeeklyDays(equipmentId),
  ]);
  const iso = (ms: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(ms));
  const booked = [...new Set(schedule.busy.flatMap((b) => daysBetween(iso(b.start), iso(b.end))))].filter((d) => d >= today);
  return { available, booked, weekly };
}

/** Dias da semana que se repetem (0 = domingo; decisão de 22/10/2026). */
export async function listWeeklyDays(equipmentId: string): Promise<number[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("equipment_weekly_days").select("weekday").eq("equipment_id", equipmentId);
  return (data ?? []).map((row) => Number(row.weekday)).sort();
}

/** Troca os dias da semana: o banco libera os próximos 90 dias e renova sozinho. */
export async function setWeeklyDays(equipmentId: string, weekdays: number[]): Promise<boolean> {
  if (!supabaseConfigured()) return true;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_weekly_days", {
    p_equipment: equipmentId,
    p_weekdays: [...new Set(weekdays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6),
  });
  return !error;
}
