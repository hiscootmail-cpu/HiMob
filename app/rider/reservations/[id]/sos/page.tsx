import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Phone } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { BookingSummary } from "@/components/rider/booking-summary";
import { getRiderBooking } from "@/lib/bookings-db";
import { SosForm } from "./sos-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.sos");
  return { title: t("title") };
}

const EMERGENCY = [
  { key: "samu", number: "192" },
  { key: "fire", number: "193" },
  { key: "police", number: "190" },
] as const;

/** SOS durante o uso (decisão de 22/10/2026): emergência primeiro, depois avisar a equipe e o Host. */
export default async function SosPage({ params }: PageProps<"/rider/reservations/[id]/sos">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("help.sos");
  const canReport = booking.status === "active" || booking.status === "confirmed";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href={`/rider/reservations/${booking.id}`} label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>

      <section aria-labelledby="emergency-title" className="flex flex-col gap-2 rounded-lg bg-pink-soft p-4">
        <h2 id="emergency-title" className="text-base font-semibold text-on-pink">
          {t("emergencyTitle")}
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {EMERGENCY.map((e) => (
            <a
              key={e.key}
              href={`tel:${e.number}`}
              className="flex flex-col items-center gap-1 rounded-lg bg-hs-white px-2 py-3 text-center outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
            >
              <Phone aria-hidden className="size-5 text-hs-black" />
              <span className="text-lg font-bold text-hs-black">{e.number}</span>
              <span className="text-xs text-hs-black">{t(`emergency.${e.key}`)}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="rounded-lg border border-line bg-hs-white p-4">
        <BookingSummary booking={booking} />
      </div>

      {canReport ? (
        <SosForm bookingId={booking.id} />
      ) : (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {t("notActive")}
        </p>
      )}
      <p className="text-xs text-muted">{t("responsibility")}</p>
    </div>
  );
}
