import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { BookingSummary } from "@/components/rider/booking-summary";
import { getRiderBooking } from "@/lib/bookings";
import { ReviewForm } from "./review-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.review");
  return { title: t("title") };
}

/** Avaliação depois da devolução (tela 9 do PDF). */
export default async function ReviewPage({ params }: PageProps<"/rider/reservations/[id]/review">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("rider.review");
  const canReview = booking.status === "completed" && !booking.rider_reviewed;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href={`/rider/reservations/${booking.id}`} label={t("back")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">
        {t("heading", { name: booking.equipment.host.full_name })}
      </h1>
      <div className="rounded-lg border border-line bg-hs-white p-4">
        <BookingSummary booking={booking} />
      </div>
      {canReview ? (
        <ReviewForm bookingId={booking.id} hostName={booking.equipment.host.full_name} />
      ) : (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {booking.rider_reviewed ? t("alreadyReviewed") : t("notAvailable")}
        </p>
      )}
    </div>
  );
}
