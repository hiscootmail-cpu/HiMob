import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { DayBlockButton } from "@/components/host/day-block-button";
import { BLOCKING_STATUSES } from "@/lib/availability";
import { addDays } from "@/lib/booking";
import type { BookingStatus } from "@/lib/bookings";
import type { HostBooking, HostListing } from "@/lib/host";
import { cn } from "@/lib/utils";

/*
 * Calendário do Host: mostra, mês a mês, os dias ocupados por reservas.
 * Com um equipamento escolhido, o Host bloqueia ou desbloqueia dias (decisão
 * de 09/10/2026). Dias já reservados ficam bloqueados sozinhos.
 * O dia escolhido vai no endereço (?day=), então funciona sem JavaScript.
 */

const SHOWN: BookingStatus[] = ["pending", "accepted", "confirmed", "active", "completed"];

const kindOf = (status: BookingStatus) =>
  status === "pending" ? "request" : status === "active" ? "inUse" : status === "completed" ? "done" : "booked";

/** Borda mais forte na legenda, para a cor aparecer bem no círculo pequeno. */
const legendClass = {
  request: "border-hs-pink",
  booked: "border-hs-green",
  inUse: "border-hs-purple",
  done: "border-muted",
  blocked: "border-hs-black",
} as const;

const kindClass = {
  request: "bg-pink-soft text-on-pink",
  booked: "bg-green-soft text-on-green",
  inUse: "bg-purple-soft text-on-purple",
  done: "bg-surface text-muted",
  blocked: "bg-line text-hs-black line-through",
} as const;

type CalendarProps = {
  bookings: HostBooking[];
  listings: HostListing[];
  /** Mês mostrado, AAAA-MM. */
  month: string;
  today: string;
  equipmentId?: string;
  selectedDay?: string;
  /** Dias bloqueados pelo Host no equipamento escolhido. */
  blockedDays?: string[];
};

function monthDays(month: string) {
  const [year, m] = month.split("-").map(Number);
  const first = `${month}-01`;
  const total = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay(); // 0 = domingo
  return { first, total, weekday };
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

/** A reserva ocupa o dia? Da retirada até a devolução, incluindo os dois dias. */
const occupies = (booking: HostBooking, day: string) => booking.start_date <= day && day <= booking.end_date;

export async function HostCalendar({ bookings, listings, month, today, equipmentId, selectedDay, blockedDays = [] }: CalendarProps) {
  const t = await getTranslations("host.calendar");
  const format = await getFormatter();
  const { first, total, weekday } = monthDays(month);
  const shown = bookings.filter(
    (b) => SHOWN.includes(b.status) && (!equipmentId || b.equipment.id === equipmentId),
  );
  const days = Array.from({ length: total }, (_, i) => addDays(first, i));
  const href = (params: Record<string, string | undefined>) => {
    const query = new URLSearchParams({ view: "calendar", month, ...(equipmentId ? { equipment: equipmentId } : {}) });
    Object.entries(params).forEach(([key, value]) => (value ? query.set(key, value) : query.delete(key)));
    return `/host/reservations?${query}`;
  };
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    format.dateTime(new Date(Date.UTC(2026, 0, 4 + i, 12)), { weekday: "short", timeZone: "UTC" }),
  );
  const dayLabel = (day: string) =>
    format.dateTime(new Date(`${day}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });
  const selected = selectedDay ? shown.filter((b) => occupies(b, selectedDay)) : [];
  const blockedSet = new Set(blockedDays);
  const selectedBooked = selected.some((b) => BLOCKING_STATUSES.includes(b.status));

  return (
    <section aria-labelledby="calendar-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Link
            href={href({ month: shiftMonth(month, -1), day: undefined })}
            aria-label={t("previous")}
            className="flex size-10 items-center justify-center rounded-full border border-line text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            <ChevronLeft className="size-5" aria-hidden />
          </Link>
          <h2 id="calendar-title" className="min-w-40 text-center text-lg font-semibold text-hs-black first-letter:uppercase">
            {format.dateTime(new Date(`${first}T12:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" })}
          </h2>
          <Link
            href={href({ month: shiftMonth(month, 1), day: undefined })}
            aria-label={t("next")}
            className="flex size-10 items-center justify-center rounded-full border border-line text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            <ChevronRight className="size-5" aria-hidden />
          </Link>
        </div>

        <form action="/host/reservations" className="flex items-center gap-2">
          <input type="hidden" name="view" value="calendar" />
          <input type="hidden" name="month" value={month} />
          <label htmlFor="calendar-equipment" className="text-sm font-medium text-hs-black">
            {t("equipment")}
          </label>
          <select
            id="calendar-equipment"
            name="equipment"
            defaultValue={equipmentId ?? ""}
            className="h-10 min-w-0 flex-1 rounded-md border border-line bg-hs-white px-3 text-sm text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25"
          >
            <option value="">{t("allEquipment")}</option>
            {listings
              .filter((l) => l.review_status === "approved")
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title}
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="h-10 cursor-pointer rounded-md border border-line bg-hs-white px-3 text-sm font-semibold text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            {t("apply")}
          </button>
        </form>
      </div>

      <ul className="flex flex-wrap gap-3 text-xs text-hs-black" aria-label={t("legend")}>
        {(["request", "booked", "inUse", "done", "blocked"] as const).map((kind) => (
          <li key={kind} className="flex items-center gap-1.5">
            <span className={cn("size-3.5 rounded-full border-2", kindClass[kind], legendClass[kind])} aria-hidden />
            {t(`kinds.${kind}`)}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-7 gap-1 text-center">
        {weekdays.map((name) => (
          <span key={name} aria-hidden className="py-1 text-xs font-semibold text-muted uppercase">
            {name}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-1 text-center" aria-labelledby="calendar-title">
          {Array.from({ length: weekday }, (_, i) => (
            <li key={`blank-${i}`} aria-hidden />
          ))}
          {days.map((day) => {
            const items = shown.filter((b) => occupies(b, day));
            const top = items[0] ? kindOf(items[0].status) : blockedSet.has(day) ? "blocked" : null;
            const isToday = day === today;
            const isSelected = day === selectedDay;
            return (
              <li key={day}>
                <Link
                  href={href({ day })}
                  scroll={false}
                  aria-label={`${dayLabel(day)}: ${t("count", { count: items.length })}`}
                  aria-current={isSelected ? "true" : isToday ? "date" : undefined}
                  className={cn(
                    "flex aspect-square flex-col items-center justify-center gap-0.5 rounded-md border text-sm outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40 sm:aspect-auto sm:h-20",
                    top ? kindClass[top] : "bg-hs-white text-hs-black hover:bg-surface",
                    isSelected ? "border-hs-black" : isToday ? "border-hs-blue" : "border-line",
                  )}
                >
                  <span className={cn("font-semibold", isToday && "underline")}>{Number(day.slice(8))}</span>
                  {items.length ? (
                    <span className="hidden text-xs sm:block">{t("count", { count: items.length })}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
      </ul>

      {selectedDay ? (
        <div className="flex flex-col gap-2 rounded-lg border border-line bg-hs-white p-4" aria-live="polite">
          <h3 className="text-base font-semibold text-hs-black">{dayLabel(selectedDay)}</h3>
          {selected.length ? (
            <ul className="flex flex-col gap-2">
              {selected.map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/host/reservations#${b.id}`}
                    className="flex flex-col rounded-md px-2 py-1 text-sm text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                  >
                    <span className="font-semibold">{b.equipment.title}</span>
                    <span className="text-muted">
                      {b.rider.full_name} · {t(`kinds.${kindOf(b.status)}`)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{blockedSet.has(selectedDay) ? t("blockedInfo") : t("free")}</p>
          )}
          {selectedDay < today ? null : !equipmentId ? (
            <p className="text-sm text-muted">{t("chooseToBlock")}</p>
          ) : selectedBooked ? (
            <p className="text-sm text-muted">{t("bookedInfo")}</p>
          ) : (
            <DayBlockButton equipmentId={equipmentId} day={selectedDay} blocked={blockedSet.has(selectedDay)} />
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("tapDay")}</p>
      )}
    </section>
  );
}
