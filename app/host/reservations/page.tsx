import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { CalendarIcon } from "@/components/icons";
import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { HostBookingActions } from "@/components/host/host-booking-actions";
import { HostCalendar } from "@/components/host/host-calendar";
import { Badge } from "@/components/ui/badge";
import { todayInSaoPaulo } from "@/lib/booking";
import { bookingPrice, type BookingStatus } from "@/lib/bookings";
import { hostCancelPolicy } from "@/lib/cancellation";
import { unavailableDays } from "@/lib/availability";
import { listHostBookings, listHostListings, type HostBooking } from "@/lib/host";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.reservations");
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

async function HostBookingCard({ booking }: { booking: HostBooking }) {
  const t = await getTranslations("host.reservations");
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const shortDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const moment = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const price = bookingPrice(booking);
  const cancel = hostCancelPolicy(booking);

  return (
    <li id={booking.id} className="flex scroll-mt-24 flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex gap-4">
        <EquipmentPhoto type={booking.equipment.type} className="size-20 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Badge tone={tones[booking.status]}>{t(`status.${booking.status}`)}</Badge>
          <p className="line-clamp-2 text-base font-semibold text-hs-black">{booking.equipment.title}</p>
          <p className="text-sm text-hs-black">
            {t.rich("rider", {
              name: booking.rider.full_name,
              link: (chunks) => (
                <Link href={`/profile/${booking.rider.id}`} className="font-semibold underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
          <p className="text-sm text-muted">
            {t("when", {
              start: `${shortDate(booking.start_date)}, ${booking.pickup_time}`,
              end: `${shortDate(booking.end_date)}, ${booking.return_time}`,
            })}{" "}
            · {t("days", { count: booking.days })}
          </p>
          <p className="text-base font-bold text-hs-black">{t("youReceive", { value: money(price.subtotal) })}</p>
        </div>
      </div>

      {booking.status === "confirmed" ? (
        <p className="rounded-md bg-surface p-3 text-sm text-hs-black">
          {cancel.allowed && cancel.paid
            ? t("cancelUntil", { deadline: moment(cancel.deadline) })
            : !cancel.allowed && cancel.deadline
              ? t("cancelDeadlinePassed", { deadline: moment(cancel.deadline) })
              : null}
        </p>
      ) : null}

      <HostBookingActions booking={booking} />
    </li>
  );
}

function Section({ id, title, items, empty }: { id: string; title: string; items: HostBooking[]; empty: string }) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold text-hs-black">
        {title} <span className="text-muted">({items.length})</span>
      </h2>
      {items.length ? (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {items.map((booking) => (
            <HostBookingCard key={booking.id} booking={booking} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{empty}</p>
      )}
    </section>
  );
}

/** Só aceita o id de um equipamento (o servidor confere o dono ao bloquear). */
const listingsFilter = (value: string | undefined) => (value && /^[\w-]+$/.test(value) ? value : undefined);

/** Reservas recebidas (Host): pedidos novos, em andamento, anteriores e calendário. */
export default async function HostReservationsPage({ searchParams }: PageProps<"/host/reservations">) {
  const t = await getTranslations("host.reservations");
  const params = await searchParams;
  const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);
  const view = one(params.view) === "calendar" ? "calendar" : "list";
  const today = todayInSaoPaulo();
  const month = /^\d{4}-\d{2}$/.test(one(params.month) ?? "") ? one(params.month)! : today.slice(0, 7);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(one(params.day) ?? "") ? one(params.day) : undefined;

  const equipmentId = listingsFilter(one(params.equipment));
  const [bookings, listings, unavailable] = await Promise.all([
    listHostBookings(),
    listHostListings(),
    equipmentId ? unavailableDays(equipmentId) : null,
  ]);
  const requests = bookings.filter((b) => b.status === "pending");
  const ongoing = bookings.filter((b) => ["accepted", "confirmed", "active"].includes(b.status));
  const past = bookings.filter((b) => ["completed", "rejected", "cancelled"].includes(b.status));
  const tabClass = (active: boolean) =>
    cn(
      "flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40 sm:flex-none",
      active ? "bg-hs-black text-hs-white" : "text-hs-black hover:bg-surface",
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
          <p className="text-base text-muted">{t("subtitle")}</p>
        </div>
        <nav aria-label={t("viewLabel")} className="flex rounded-full border border-line p-1">
          <Link href="/host/reservations" aria-current={view === "list" ? "page" : undefined} className={tabClass(view === "list")}>
            {t("viewList")}
          </Link>
          <Link
            href="/host/reservations?view=calendar"
            aria-current={view === "calendar" ? "page" : undefined}
            className={tabClass(view === "calendar")}
          >
            {t("viewCalendar")}
          </Link>
        </nav>
      </div>

      {view === "calendar" ? (
        <HostCalendar
          bookings={bookings}
          listings={listings}
          month={month}
          today={today}
          equipmentId={equipmentId}
          selectedDay={day}
          blockedDays={unavailable?.blocked}
        />
      ) : bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center">
          <CalendarIcon className="size-10 text-muted" />
          <h2 className="text-base font-semibold text-hs-black">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted">{t("emptyText")}</p>
        </div>
      ) : (
        <>
          <Section id="requests-title" title={t("requests")} items={requests} empty={t("noRequests")} />
          <Section id="ongoing-title" title={t("ongoing")} items={ongoing} empty={t("noOngoing")} />
          <Section id="past-title" title={t("past")} items={past} empty={t("noPast")} />
        </>
      )}
    </div>
  );
}
