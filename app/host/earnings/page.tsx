import type { Metadata } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { EarningsTabs } from "@/components/host/earnings-tabs";
import { todayInSaoPaulo } from "@/lib/booking";
import { bookingPrice } from "@/lib/bookings";
import { durationText } from "@/lib/duration";
import { listHostBookings } from "@/lib/host";
import { PLATFORM_FEE_PERCENT } from "@/lib/pricing";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.earnings");
  return { title: t("title") };
}

/** Reservas que geram dinheiro para o Host: pagas (cupom grátis não conta). */
const PAID = new Set(["confirmed", "active", "completed"]);

/**
 * Ganhos do Host (decisão de 22/10/2026): quanto entrou no dia, no mês e no ano,
 * mês a mês, reserva a reserva, e quando o dinheiro cai.
 * Data de cada ganho: o dia da retirada.
 */
export default async function HostEarningsPage() {
  if (supabaseConfigured()) await requireUser();
  const t = await getTranslations("host.earnings");
  const tDuration = await getTranslations("duration");
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });

  const today = todayInSaoPaulo();
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const paid = (await listHostBookings())
    .filter((b) => PAID.has(b.status) && !b.free)
    .map((b) => ({ booking: b, amount: bookingPrice(b).subtotal }))
    .sort((a, b) => b.booking.start_date.localeCompare(a.booking.start_date));
  const sum = (prefix: string) => paid.filter((p) => p.booking.start_date.startsWith(prefix)).reduce((s, p) => s + p.amount, 0);

  const totals = [
    { label: t("today"), value: sum(today) },
    { label: t("month"), value: sum(month) },
    { label: t("year"), value: sum(year) },
  ];

  // Últimos 12 meses.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(Number(year), Number(month.slice(5)) - 1 - i, 1));
    return d.toISOString().slice(0, 7);
  }).reverse();
  const byMonth = months.map((m) => ({ month: m, value: sum(m) }));
  const top = Math.max(1, ...byMonth.map((m) => m.value));
  const monthName = (m: string) => format.dateTime(new Date(`${m}-15T12:00:00Z`), { month: "short", year: "2-digit", timeZone: "UTC" });
  const day = (d: string) => format.dateTime(new Date(`${d}T12:00:00Z`), { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>
      <EarningsTabs />

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {totals.map((total) => (
          <li key={total.label} className="flex flex-col gap-1 rounded-lg border border-line bg-hs-white p-4">
            <span className="text-sm text-muted">{total.label}</span>
            <span className="text-2xl font-bold text-hs-black">{money(total.value)}</span>
          </li>
        ))}
      </ul>

      <section aria-labelledby="when-title" className="flex flex-col gap-2 rounded-lg bg-blue-soft p-4">
        <h2 id="when-title" className="text-base font-semibold text-on-blue">
          {t("whenTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-hs-black">
          <li>{t("when1")}</li>
          <li>{t("when2", { fee: PLATFORM_FEE_PERCENT })}</li>
          <li>{t("when3")}</li>
          <li>{t("when4")}</li>
        </ul>
      </section>

      <section aria-labelledby="months-title" className="flex flex-col gap-3">
        <h2 id="months-title" className="text-lg font-semibold text-hs-black">
          {t("byMonth")}
        </h2>
        <ol className="flex flex-col gap-1.5">
          {byMonth.map((m) => (
            <li key={m.month} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-3 text-sm">
              <span className="inline-block whitespace-nowrap text-muted first-letter:uppercase">{monthName(m.month)}</span>
              <span aria-hidden className="h-3 overflow-hidden rounded-full bg-surface">
                <span className="block h-full rounded-full bg-hs-green" style={{ width: `${(m.value / top) * 100}%` }} />
              </span>
              <span className="text-right font-semibold text-hs-black">{money(m.value)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="list-title" className="flex flex-col gap-3">
        <h2 id="list-title" className="text-lg font-semibold text-hs-black">
          {t("list")}
        </h2>
        {paid.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {paid.map(({ booking, amount }) => (
              <li key={booking.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-semibold text-hs-black">{booking.equipment.title}</span>
                  <span className="text-xs text-muted">
                    {day(booking.start_date)} · {durationText(tDuration, booking.hours)} · {booking.rider.full_name}
                  </span>
                </span>
                <span className="text-base font-bold text-hs-black">{money(amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
