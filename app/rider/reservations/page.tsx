import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CalendarIcon } from "@/components/icons";
import { BookingActions } from "@/components/rider/booking-actions";
import { BookingSummary } from "@/components/rider/booking-summary";
import { Button } from "@/components/ui/button";
import { listRiderBookings, ONGOING, type Booking } from "@/lib/bookings";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.list");
  return { title: t("title") };
}

function BookingList({ items }: { items: Booking[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((booking) => (
        <li key={booking.id} className="flex flex-col gap-3 rounded-lg border border-line bg-hs-white p-4">
          <BookingSummary booking={booking} />
          <BookingActions booking={booking} />
        </li>
      ))}
    </ul>
  );
}

/** Minhas reservas (Rider): em andamento e anteriores. */
export default async function RiderReservationsPage() {
  // Com a Supabase, só quem entrou na conta (na demonstração, a tela abre direto).
  if (supabaseConfigured()) await requireUser();
  const t = await getTranslations("rider.list");
  const bookings = await listRiderBookings();
  const ongoing = bookings.filter((b) => ONGOING.includes(b.status));
  const past = bookings.filter((b) => !ONGOING.includes(b.status));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>

      {bookings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center">
          <CalendarIcon className="size-10 text-muted" />
          <h2 className="text-base font-semibold text-hs-black">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted">{t("emptyText")}</p>
          <Button asChild>
            <Link href="/">{t("explore")}</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className="flex flex-col gap-3" aria-labelledby="ongoing-title">
            <h2 id="ongoing-title" className="text-lg font-semibold text-hs-black">
              {t("ongoing")}
            </h2>
            {ongoing.length ? <BookingList items={ongoing} /> : <p className="text-sm text-muted">{t("noOngoing")}</p>}
          </section>
          <section className="flex flex-col gap-3" aria-labelledby="past-title">
            <h2 id="past-title" className="text-lg font-semibold text-hs-black">
              {t("past")}
            </h2>
            {past.length ? <BookingList items={past} /> : <p className="text-sm text-muted">{t("noPast")}</p>}
          </section>
        </>
      )}
    </div>
  );
}
