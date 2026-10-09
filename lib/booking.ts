/*
 * Cálculo de reserva por DIÁRIA (regra 1: nunca por hora).
 * Datas no formato AAAA-MM-DD. Retirada num dia e devolução no outro = 1 diária.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function parse(date: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(`${date}T00:00:00Z`);
  return Number.isNaN(time) ? null : time;
}

/** Data de hoje em São Paulo, no formato AAAA-MM-DD. */
export function todayInSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

export function addDays(date: string, days: number): string {
  const time = parse(date);
  if (time === null) return date;
  return new Date(time + days * DAY_MS).toISOString().slice(0, 10);
}

export type BookingDatesError = "pickupRequired" | "returnRequired" | "pickupInPast" | "returnBeforePickup";

export function validateBookingDates(pickup: string, dropoff: string, today: string): BookingDatesError | null {
  const start = parse(pickup);
  if (start === null) return "pickupRequired";
  const end = parse(dropoff);
  if (end === null) return "returnRequired";
  if (start < (parse(today) ?? 0)) return "pickupInPast";
  if (end <= start) return "returnBeforePickup";
  return null;
}

/** Número de diárias entre retirada e devolução (0 se as datas não valem). */
export function countDays(pickup: string, dropoff: string): number {
  const start = parse(pickup);
  const end = parse(dropoff);
  if (start === null || end === null || end <= start) return 0;
  return Math.round((end - start) / DAY_MS);
}

/** Todos os dias de start a end (AAAA-MM-DD), incluindo os dois. */
export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  for (let day = start; day <= end && days.length < 366; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Primeiro dia do período (retirada até devolução) que não está livre, ou null. */
export function firstConflict(pickup: string, dropoff: string, unavailable: Iterable<string>): string | null {
  const taken = new Set(unavailable);
  return daysBetween(pickup, dropoff).find((day) => taken.has(day)) ?? null;
}

/** Junta dias seguidos em períodos: ["10","11","12","20"] → [{10..12}, {20..20}]. */
export function toRanges(days: string[]): { start: string; end: string }[] {
  const ranges: { start: string; end: string }[] = [];
  for (const day of [...days].sort()) {
    const last = ranges.at(-1);
    if (last && addDays(last.end, 1) === day) last.end = day;
    else ranges.push({ start: day, end: day });
  }
  return ranges;
}
