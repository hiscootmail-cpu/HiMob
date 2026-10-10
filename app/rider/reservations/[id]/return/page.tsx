import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { BookingSummary } from "@/components/rider/booking-summary";
import { HandoffForm } from "@/components/rider/handoff-form";
import { HANDOFF_WAIT_HOURS } from "@/lib/bookings";
import { getRiderBooking } from "@/lib/bookings-db";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.handoff.return");
  return { title: t("title") };
}

/** Devolução (tela 8 do PDF): QR code + foto do equipamento. */
export default async function ReturnPage({ params }: PageProps<"/rider/reservations/[id]/return">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("rider.handoff");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href={`/rider/reservations/${booking.id}`} label={t("back")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("return.title")}</h1>
      <div className="rounded-lg border border-line bg-hs-white p-4">
        <BookingSummary booking={booking} />
      </div>
      {booking.status === "active" && booking.confirmed?.return.rider ? (
        <div role="status" className="flex flex-col gap-1 rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">
          <p className="font-semibold">{t("waitingTitle")}</p>
          <p>{t("waitingText", { name: booking.equipment.host.full_name, hours: HANDOFF_WAIT_HOURS })}</p>
        </div>
      ) : booking.status === "active" ? (
        <HandoffForm bookingId={booking.id} kind="return" otherName={booking.equipment.host.full_name} />
      ) : (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {t("return.notAvailable")}
        </p>
      )}
    </div>
  );
}
