import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { MapPinIcon } from "@/components/icons";
import { BackLink } from "@/components/rider/back-link";
import { BookingActions } from "@/components/rider/booking-actions";
import { BookingSteps } from "@/components/rider/booking-steps";
import { BookingSummary } from "@/components/rider/booking-summary";
import { getRiderBooking } from "@/lib/bookings-db";
import { riderCancelPolicy } from "@/lib/cancellation";

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
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });
  const moment = (date: Date) =>
    format.dateTime(date, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const policy = riderCancelPolicy(booking);
  const cancelInfo = policy.allowed
    ? policy.paid
      ? t("cancelUntil", { deadline: moment(policy.deadline), refund: money(policy.refund), fee: money(policy.fee) })
      : t("cancelFree")
    : policy.reason === "deadlinePassed" && policy.deadline
      ? t("cancelDeadlinePassed", { deadline: moment(policy.deadline) })
      : null;

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
        <div role="status" className="flex flex-col gap-1 rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          <p>{banner}</p>
          {booking.status === "rejected" && booking.reject_reason ? (
            <p className="font-medium">{t("rejectedReason", { reason: booking.reject_reason })}</p>
          ) : null}
        </div>
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
        <p className="text-sm text-hs-black">
          {t("times", {
            pickup: `${longDate(booking.start_date)}, ${booking.pickup_time}`,
            return: `${longDate(booking.end_date)}, ${booking.return_time}`,
          })}
        </p>
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

      {cancelInfo ? (
        <section aria-labelledby="cancel-title" className="flex flex-col gap-1 rounded-lg bg-surface p-4">
          <h2 id="cancel-title" className="text-sm font-semibold text-hs-black">
            {t("cancelTitle")}
          </h2>
          <p className="text-sm text-hs-black">{cancelInfo}</p>
        </section>
      ) : null}

      <BookingActions booking={booking} showDetails={false} />
    </div>
  );
}
