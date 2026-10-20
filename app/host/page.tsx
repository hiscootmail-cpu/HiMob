import type { Metadata } from "next";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { CalendarIcon, KeyIcon, PlusIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { listAvailableDays } from "@/lib/availability";
import { addDays, saoPauloTime, todayInSaoPaulo } from "@/lib/booking";
import type { BookingStatus } from "@/lib/bookings";
import { durationText } from "@/lib/duration";
import { listHostBookings, listHostListings, type HostBooking } from "@/lib/host";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.overview");
  return { title: t("title") };
}

const tones: Record<BookingStatus, "pending" | "info" | "success" | "highlight" | "neutral" | "error"> = {
  pending: "pending",
  accepted: "info",
  confirmed: "success",
  active: "highlight",
  completed: "neutral",
  rejected: "error",
  cancelled: "neutral",
};

/** Dias do período que olhamos para "dias liberados". */
const AHEAD_DAYS = 30;

/**
 * Visão geral do Host (pedido de 20/10/2026): num lugar só, os pedidos novos,
 * os próximos aluguéis (que já aparecem aqui assim que são confirmados), o que
 * está em uso, o valor das reservas pagas no mês e cada anúncio com os dias
 * liberados e a próxima reserva.
 */
export default async function HostOverviewPage() {
  if (supabaseConfigured()) await requireUser();
  const t = await getTranslations("host.overview");
  const tStatus = await getTranslations("host.reservations.status");
  const tDuration = await getTranslations("duration");
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const when = (date: string, time: string) =>
    `${format.dateTime(new Date(`${date}T12:00:00Z`), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })}, ${time}`;

  const today = todayInSaoPaulo();
  const [bookings, listings] = await Promise.all([listHostBookings(), listHostListings()]);
  const availability = await Promise.all(listings.map((l) => listAvailableDays(l.id, today)));
  const until = addDays(today, AHEAD_DAYS);

  const pending = bookings.filter((b) => b.status === "pending");
  const upcoming = bookings
    .filter((b) => b.status === "accepted" || b.status === "confirmed" || b.status === "active")
    .sort((a, b) => saoPauloTime(a.start_date, a.pickup_time) - saoPauloTime(b.start_date, b.pickup_time));
  const inUse = bookings.filter((b) => b.status === "active");
  // Valor do Host nas reservas pagas com retirada neste mês (reserva grátis não conta).
  const month = today.slice(0, 7);
  const monthAmount = bookings
    .filter((b) => ["confirmed", "active", "completed"].includes(b.status) && !b.free && b.start_date.startsWith(month))
    .reduce((sum, b) => sum + b.host_amount, 0);

  const tiles = [
    { label: t("tiles.pending"), value: String(pending.length), href: "/host/reservations", highlight: pending.length > 0 },
    { label: t("tiles.upcoming"), value: String(upcoming.length), href: "/host/reservations", highlight: false },
    { label: t("tiles.inUse"), value: String(inUse.length), href: "/host/reservations", highlight: false },
    { label: t("tiles.month"), value: money(monthAmount), href: "/host/reservations", highlight: false },
  ];

  const nextOf = (listingId: string): HostBooking | undefined => upcoming.find((b) => b.equipment.id === listingId);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
          <p className="text-base text-muted">{t("subtitle")}</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/host/equipment/new">
            <PlusIcon />
            {t("newListing")}
          </Link>
        </Button>
      </div>

      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.label}>
            <Link
              href={tile.href}
              className={
                tile.highlight
                  ? "flex h-full flex-col gap-1 rounded-lg border border-hs-pink bg-pink-soft p-4 outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                  : "flex h-full flex-col gap-1 rounded-lg border border-line bg-hs-white p-4 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
              }
            >
              <span className={tile.highlight ? "text-sm text-on-pink" : "text-sm text-muted"}>{tile.label}</span>
              <span className={tile.highlight ? "text-2xl font-bold text-on-pink" : "text-2xl font-bold text-hs-black"}>{tile.value}</span>
            </Link>
          </li>
        ))}
      </ul>

      <section aria-labelledby="next-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="next-title" className="text-lg font-bold text-hs-black">{t("nextTitle")}</h2>
          <Link href="/host/reservations" className="text-sm font-semibold text-hs-black underline underline-offset-2">
            {t("seeAllReservations")}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{t("nextEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, 6).map((b) => (
              <li key={b.id}>
                <Link
                  href={`/host/reservations#${b.id}`}
                  className="flex flex-col gap-1 rounded-lg border border-line bg-hs-white p-3 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-hs-black">{b.equipment.title}</span>
                    <span className="text-sm text-muted">
                      {when(b.start_date, b.pickup_time)} → {when(b.end_date, b.return_time)} · {durationText(tDuration, b.hours)} · {b.rider.full_name}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2">
                    <Badge tone={tones[b.status]}>
                      {b.free && b.status === "confirmed" ? tStatus("confirmedFree") : tStatus(b.status)}
                    </Badge>
                    <span className="text-sm font-semibold text-hs-black">{b.free ? t("free") : money(b.host_amount)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="listings-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="listings-title" className="text-lg font-bold text-hs-black">{t("listingsTitle")}</h2>
          <Link href="/host/equipment" className="text-sm font-semibold text-hs-black underline underline-offset-2">
            {t("seeAllListings")}
          </Link>
        </div>
        {listings.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-10 text-center">
            <KeyIcon className="size-10 text-muted" />
            <p className="text-sm text-muted">{t("listingsEmpty")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {listings.map((listing, index) => {
              const openDays = availability[index].filter((d) => d <= until).length;
              const next = nextOf(listing.id);
              return (
                <li key={listing.id} className="flex flex-col gap-3 rounded-lg border border-line bg-hs-white p-4">
                  <div className="flex gap-3">
                    <EquipmentPhoto type={listing.type} src={listing.photos[0]} className="size-16 shrink-0 rounded-md" />
                    <div className="flex min-w-0 flex-col gap-1">
                      <p className="text-base font-semibold text-hs-black">{listing.title}</p>
                      <p className="text-sm text-hs-black">
                        {listing.review_status === "approved"
                          ? listing.is_available
                            ? t("listingLive")
                            : t("listingPaused")
                          : listing.review_status === "pending"
                            ? t("listingReview")
                            : t("listingRejected")}
                      </p>
                      <p className={openDays ? "text-sm text-muted" : "text-sm font-semibold text-error"}>
                        {openDays ? t("openDays", { count: openDays, days: AHEAD_DAYS }) : t("noOpenDays")}
                      </p>
                      <p className="text-sm text-muted">
                        {next ? t("nextBooking", { when: when(next.start_date, next.pickup_time) }) : t("noNextBooking")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={`/host/equipment/${listing.id}/edit`}>
                        <Pencil aria-hidden />
                        {t("edit")}
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/host/equipment/${listing.id}/availability`}>
                        <CalendarIcon className="size-4" />
                        {t("availableDays")}
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
