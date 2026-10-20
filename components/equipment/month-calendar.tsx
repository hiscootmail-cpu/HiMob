"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/*
 * Calendário de um mês, usado pelo Rider (escolher os dias da reserva) e pelo
 * Host (liberar os dias disponíveis). Datas sempre AAAA-MM-DD; a semana começa
 * no domingo, como no calendário brasileiro.
 */

export type DayLook = "available" | "selected" | "inRange" | "busy" | "closed" | "off";

const pad = (n: number) => String(n).padStart(2, "0");

/** "2026-11" + 1 → "2026-12". */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** Todos os dias do mês (AAAA-MM-DD). */
export function daysOfMonth(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** 0 = domingo … 6 = sábado. */
export const weekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay();

const look: Record<DayLook, string> = {
  available: "bg-green-soft text-on-green hover:ring-2 hover:ring-hs-green",
  selected: "bg-hs-black text-hs-white",
  inRange: "bg-hs-black/80 text-hs-white",
  busy: "bg-pink-soft text-on-pink",
  closed: "bg-surface text-hs-black hover:ring-2 hover:ring-line",
  off: "text-muted",
};

export function MonthCalendar({
  month,
  onMonthChange,
  minMonth,
  maxMonth,
  dayLook,
  onSelect,
  dayLabel,
}: {
  month: string;
  onMonthChange: (month: string) => void;
  minMonth: string;
  maxMonth: string;
  dayLook: (day: string) => DayLook;
  /** Sem onSelect, ou dia "off", o dia não é clicável. */
  onSelect?: (day: string) => void;
  /** Texto lido por leitor de tela para cada dia (ex.: "disponível"). */
  dayLabel?: (day: string, look: DayLook) => string;
}) {
  const t = useTranslations("calendar");
  const format = useFormatter();
  const days = daysOfMonth(month);
  const lead = weekday(days[0]);
  const title = format.dateTime(new Date(`${month}-15T12:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" });
  const weekNames = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(Date.UTC(2026, 10, 1 + i, 12)), { weekday: "narrow", timeZone: "UTC" }),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, -1))}
          disabled={month <= minMonth}
          aria-label={t("previous")}
          className="flex size-9 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 disabled:opacity-30"
        >
          <ChevronLeft className="size-5" />
        </button>
        <p className="text-sm font-semibold text-hs-black first-letter:uppercase" aria-live="polite">
          {title}
        </p>
        <button
          type="button"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
          disabled={month >= maxMonth}
          aria-label={t("next")}
          className="flex size-9 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 disabled:opacity-30"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center" role="grid" aria-label={title}>
        {weekNames.map((name, i) => (
          <span key={i} aria-hidden className="text-xs font-semibold text-muted uppercase">
            {name}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((day) => {
          const kind = dayLook(day);
          const clickable = Boolean(onSelect) && kind !== "off";
          return (
            <button
              key={day}
              type="button"
              disabled={!clickable}
              onClick={() => onSelect?.(day)}
              aria-pressed={kind === "selected" || kind === "inRange"}
              aria-label={`${format.dateTime(new Date(`${day}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" })}${dayLabel ? `, ${dayLabel(day, kind)}` : ""}`}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
                look[kind],
                !clickable && "cursor-default",
              )}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
