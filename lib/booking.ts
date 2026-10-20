/*
 * Datas e horários da reserva. Datas no formato AAAA-MM-DD, horas HH:MM
 * (horário de Brasília). Desde 20/10/2026 dá para alugar por horas: o Rider
 * escolhe dia e hora de retirada e de devolução (preço em lib/pricing.ts).
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

/** Brasília não tem horário de verão desde 2019: sempre -03:00. */
export const saoPauloTime = (date: string, time: string) => Date.parse(`${date}T${time.slice(0, 5)}:00-03:00`);

/** Duração em horas entre retirada e devolução (0 se não vale). */
export function rentalHours(startDate: string, startTime: string, endDate: string, endTime: string): number {
  const start = saoPauloTime(startDate, startTime);
  const end = saoPauloTime(endDate, endTime);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return (end - start) / (60 * 60 * 1000);
}

/** Dias do calendário de start a end, contando os dois (mesmo dia = 1). */
export function calendarDays(start: string, end: string): number {
  const a = parse(start);
  const b = parse(end);
  return a === null || b === null || b < a ? 0 : Math.round((b - a) / DAY_MS) + 1;
}

/** Horários de 30 em 30 minutos dentro do atendimento do Host ("HH:MM"). */
export function timeSlots(openFrom: string, openUntil: string): string[] {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let from = toMin(openFrom);
  let until = toMin(openUntil);
  if (until <= from) {
    // Atende 24 h.
    from = 0;
    until = 24 * 60 - 30;
  }
  const slots: string[] = [];
  for (let m = Math.ceil(from / 30) * 30; m <= until; m += 30) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return slots;
}
