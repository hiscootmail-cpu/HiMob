"use client";

import { useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";

import { daysOfMonth, MonthCalendar, shiftMonth, weekday } from "@/components/equipment/month-calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { saveAvailability, saveWeeklyDays } from "@/app/host/equipment/[id]/availability/actions";

/** Até 6 meses à frente. */
const MONTHS_AHEAD = 6;
/** Dias que se repetem: liberados pelos próximos 90 dias (o banco renova todo dia). */
const WEEKLY_WINDOW = 90;
/** Ordem dos chips: segunda a domingo (0 = domingo). */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function windowDays(today: string): string[] {
  const start = new Date(`${today}T12:00:00Z`).getTime();
  return Array.from({ length: WEEKLY_WINDOW + 1 }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}

/**
 * Calendário do Host: tocar num dia libera ou tira. Atalhos para o mês na tela:
 * o mês todo, só fins de semana, só dias úteis, limpar.
 * Com `listingId`, salva na hora. Sem ele (anúncio novo), guarda os dias num
 * campo escondido do formulário (`name`) e o anúncio salva junto.
 * "Repetir toda semana" (decisão de 22/10/2026): libera os dias da semana
 * escolhidos pelos próximos 90 dias e o site renova sozinho.
 */
export function AvailabilityEditor({
  listingId,
  name,
  today,
  initial,
  booked,
  weekly = [],
}: {
  listingId?: string;
  name?: string;
  today: string;
  initial: string[];
  /** Dias com reserva aceita (não podem sair). */
  booked: string[];
  /** Dias da semana que se repetem (0 = domingo). */
  weekly?: number[];
}) {
  const format = useFormatter();
  const [repeat, setRepeat] = useState(() => new Set(weekly));
  const [savedRepeat, setSavedRepeat] = useState(() => new Set(weekly));
  const repeatChanged = [...repeat].sort().join() !== [...savedRepeat].sort().join();
  const dayName = (d: number) => format.dateTime(new Date(Date.UTC(2026, 10, 1 + d, 12)), { weekday: "short", timeZone: "UTC" });
  const t = useTranslations("host.availability");
  const [available, setAvailable] = useState(() => new Set(initial));
  const [month, setMonth] = useState(today.slice(0, 7));
  const [pending, start] = useTransition();
  const bookedSet = new Set(booked);
  const firstMonth = today.slice(0, 7);
  const lastMonth = shiftMonth(firstMonth, MONTHS_AHEAD);
  const futureDays = daysOfMonth(month).filter((d) => d >= today);

  const save = (add: string[], remove: string[]) => {
    const removable = remove.filter((d) => !bookedSet.has(d));
    if (!add.length && !removable.length) return;
    // Mostra na hora; o servidor devolve a lista certa.
    setAvailable((current) => {
      const next = new Set(current);
      add.forEach((d) => next.add(d));
      removable.forEach((d) => next.delete(d));
      return next;
    });
    if (!listingId) return;
    start(async () => {
      const result = await saveAvailability(listingId, add, removable);
      if (result.available) setAvailable(new Set(result.available));
      if (!result.ok) toast.error(t("saveError"));
      else if (result.kept.length) toast.error(t("keptBooked"));
    });
  };

  const setMonthTo = (wanted: (day: string) => boolean) => {
    const add = futureDays.filter((d) => wanted(d) && !available.has(d));
    const remove = futureDays.filter((d) => !wanted(d) && available.has(d));
    save(add, remove);
  };
  const isWeekend = (d: string) => weekday(d) === 0 || weekday(d) === 6;

  const applyRepeat = () => {
    const wanted = new Set(repeat);
    const days = windowDays(today);
    if (!listingId) {
      // Anúncio novo: marca no calendário; o anúncio salva junto.
      setAvailable((current) => {
        const next = new Set(current);
        days.forEach((d) => {
          if (wanted.has(weekday(d))) next.add(d);
          else if (savedRepeat.has(weekday(d)) && !bookedSet.has(d)) next.delete(d);
        });
        return next;
      });
      setSavedRepeat(wanted);
      return;
    }
    start(async () => {
      const result = await saveWeeklyDays(listingId, [...wanted]);
      if (!result.ok) {
        toast.error(t("saveError"));
        return;
      }
      setSavedRepeat(wanted);
      if (result.available) setAvailable(new Set(result.available));
      else
        setAvailable((current) => {
          const next = new Set(current);
          days.forEach((d) => {
            if (wanted.has(weekday(d))) next.add(d);
            else if (savedRepeat.has(weekday(d)) && !bookedSet.has(d)) next.delete(d);
          });
          return next;
        });
      toast.success(t("repeatSaved"));
    });
  };
  const count = futureDays.filter((d) => available.has(d)).length;

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      {name ? <input type="hidden" name={name} value={JSON.stringify([...available].filter((d) => d >= today).sort())} /> : null}
      {name ? <input type="hidden" name={`${name}_weekly`} value={JSON.stringify([...savedRepeat])} /> : null}
      <div className="flex flex-col gap-2 rounded-md bg-green-soft/50 p-3">
        <p className="text-sm font-semibold text-hs-black">{t("repeatTitle")}</p>
        <p className="text-xs text-hs-black">{t("repeatHelp")}</p>
        <div role="group" aria-label={t("repeatTitle")} className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((d) => {
            const on = repeat.has(d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setRepeat((current) => {
                    const next = new Set(current);
                    if (on) next.delete(d);
                    else next.add(d);
                    return next;
                  })
                }
                className={cn(
                  "h-9 min-w-12 cursor-pointer rounded-full border px-3 text-sm font-medium capitalize outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
                  on ? "border-hs-black bg-hs-black text-hs-white" : "border-line bg-hs-white text-hs-black hover:bg-surface",
                )}
              >
                {dayName(d)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" disabled={pending || !repeatChanged} onClick={applyRepeat}>
            {t("repeatSave")}
          </Button>
          <p className="text-xs text-hs-black">
            {savedRepeat.size
              ? t("repeatOn", { days: WEEK_ORDER.filter((d) => savedRepeat.has(d)).map(dayName).join(", ") })
              : t("repeatOff")}
          </p>
        </div>
      </div>
      <MonthCalendar
        month={month}
        onMonthChange={setMonth}
        minMonth={firstMonth}
        maxMonth={lastMonth}
        dayLook={(day) =>
          day < today ? "off" : bookedSet.has(day) ? "busy" : available.has(day) ? "available" : "closed"
        }
        onSelect={(day) => {
          if (day < today) return;
          if (bookedSet.has(day)) {
            toast.error(t("keptBooked"));
            return;
          }
          if (available.has(day)) save([], [day]);
          else save([day], []);
        }}
        dayLabel={(day, look) =>
          look === "available" ? t("dayOpen") : look === "busy" ? t("dayBooked") : look === "off" ? t("dayPast") : t("dayClosed")
        }
      />
      <div className="flex flex-wrap gap-3 text-xs text-hs-black">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-green-soft ring-1 ring-hs-green" />
          {t("legendOpen")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-surface ring-1 ring-line" />
          {t("legendClosed")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-3 rounded-sm bg-pink-soft ring-1 ring-hs-pink" />
          {t("legendBooked")}
        </span>
      </div>
      <p role="status" className="text-sm font-semibold text-hs-black">
        {t("countInMonth", { count })}
      </p>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium text-hs-black">{t("shortcuts")}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setMonthTo(() => true)}>
            {t("wholeMonth")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setMonthTo(isWeekend)}>
            {t("weekends")}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => setMonthTo((d) => !isWeekend(d))}>
            {t("weekdays")}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => setMonthTo(() => false)}>
            {t("clearMonth")}
          </Button>
        </div>
        <p className="text-xs text-muted">{t("shortcutsHelp")}</p>
      </div>
    </section>
  );
}
