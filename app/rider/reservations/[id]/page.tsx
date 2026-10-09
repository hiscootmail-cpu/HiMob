import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { MapPinIcon } from "@/components/icons";
import { BackLink } from "@/components/rider/back-link";
import { BookingActions } from "@/components/rider/booking-actions";
import { BookingSteps } from "@/components/rider/booking-steps";
import { BookingSummary } from "@/components/rider/booking-summary";
import { getRiderBooking } from "@/lib/bookings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.track");
  return { title: t("title") };
}

/** Acompanhamento da reserva (tela 6 do PDF). */
export default async function TrackReservationPage({ params }: PageProps<"/rider/reservations/[id]">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("rider.track");

  const banner =
    booking.status === "pending"
      ? t("pendingBanner")
      : booking.status === "rejected"
        ? t("rejectedBanner")
        : booking.status === "cancelled"
          ? t("cancelledBanner")
          : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/rider/reservations" label={t("back")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>

      <div className="rounded-lg border border-line bg-hs-white p-4">
        <BookingSummary booking={booking} />
      </div>

      {banner ? (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {banner}
        </p>
      ) : null}

      {booking.status === "rejected" || booking.status === "cancelled" ? null : (
        <section aria-labelledby="steps-title" className="flex flex-col gap-3">
          <h2 id="steps-title" className="text-lg font-semibold text-hs-black">
            {t("stepsTitle")}
          </h2>
          <BookingSteps status={booking.status} />
        </section>
      )}

      <section aria-labelledby="where-title" className="flex flex-col gap-2 rounded-lg border border-line p-4">
        <h2 id="where-title" className="flex items-center gap-2 text-base font-semibold text-hs-black">
          <MapPinIcon className="size-5" />
          {t("whereTitle")}
        </h2>
        {booking.pickup_address ? (
          <p className="text-base text-hs-black">{booking.pickup_address}</p>
        ) : (
          <>
            <p className="text-base text-hs-black">
              {booking.equipment.area}, {booking.equipment.city}
            </p>
            <p className="text-sm text-muted">{t("addressAfterPayment")}</p>
          </>
        )}
      </section>

      <BookingActions booking={booking} showDetails={false} />
    </div>
  );
}
