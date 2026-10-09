import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { CheckCircleIcon, MapPinIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { getRiderBooking } from "@/lib/bookings";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.confirmed");
  return { title: t("title") };
}

/** Reserva confirmada (tela 5 do PDF): mostra o endereço exato de retirada. */
export default async function ConfirmedPage({ params }: PageProps<"/rider/reservations/[id]/confirmed">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("rider.confirmed");
  const format = await getFormatter();
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

  // PROVISÓRIO: nos exemplos, a reserva "aceita" ainda não tem endereço; mostra o bairro.
  const address = booking.pickup_address ?? `${booking.equipment.area}, ${booking.equipment.city}`;

  return (
    <div className="flex flex-1 justify-center bg-surface px-4 py-10 sm:py-16">
      <div className="flex w-full max-w-md flex-col items-center gap-5 rounded-lg border border-line bg-hs-white p-6 text-center sm:p-8">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-soft">
          <CheckCircleIcon className="size-9 text-on-green" />
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-hs-black">{t("title")}</h1>
          <p className="text-base text-muted">{t("subtitle", { title: booking.equipment.title })}</p>
        </div>

        <div className="flex w-full flex-col gap-3 rounded-md border border-line p-4 text-left">
          <p className="flex items-center gap-2 text-sm font-semibold text-hs-black">
            <MapPinIcon className="size-5" />
            {t("whereTitle")}
          </p>
          <p className="text-base text-hs-black">{address}</p>
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm">
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">{t("pickup")}</span>
              <span className="text-hs-black">
                {longDate(booking.start_date)}, {booking.pickup_time}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold tracking-wide text-muted uppercase">{t("return")}</span>
              <span className="text-hs-black">
                {longDate(booking.end_date)}, {booking.return_time}
              </span>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted">{t("qrHint")}</p>

        <div className="flex w-full flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href={`/rider/reservations/${booking.id}`}>{t("track")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="w-full">
            <Link href={`/conversations/${booking.equipment.id}`}>{t("talkToHost")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
