import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { BookingSummary } from "@/components/rider/booking-summary";
import { HandoffForm } from "@/components/rider/handoff-form";
import { getRiderBooking } from "@/lib/bookings-db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.handoff.pickup");
  return { title: t("title") };
}

/** Retirada (tela 7 do PDF): QR code + foto do equipamento. */
export default async function PickupPage({ params }: PageProps<"/rider/reservations/[id]/pickup">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("rider.handoff");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href={`/rider/reservations/${booking.id}`} label={t("back")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("pickup.title")}</h1>
      <div className="rounded-lg border border-line bg-hs-white p-4">
        <BookingSummary booking={booking} />
      </div>
      {booking.status === "confirmed" ? (
        <HandoffForm bookingId={booking.id} kind="pickup" />
      ) : (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {t("pickup.notAvailable")}
        </p>
      )}
    </div>
  );
}
