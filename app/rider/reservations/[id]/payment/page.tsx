import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { BookingSummary } from "@/components/rider/booking-summary";
import { bookingPrice, getRiderBooking } from "@/lib/bookings";
import { PLATFORM_FEE_PERCENT, riderDailyPrice } from "@/lib/pricing";
import { PaymentForm } from "./payment-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("rider.payment");
  return { title: t("title") };
}

/** Pagamento (tela 4 do PDF). Só aparece quando o Host já aceitou. */
export default async function PaymentPage({ params }: PageProps<"/rider/reservations/[id]/payment">) {
  const { id } = await params;
  const booking = await getRiderBooking(id);
  if (!booking) notFound();
  const t = await getTranslations("rider.payment");
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const price = bookingPrice(booking);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href={`/rider/reservations/${booking.id}`} label={t("back")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>

      <div className="rounded-lg border border-line bg-hs-white p-4">
        <BookingSummary booking={booking} showStatus={false} />
      </div>

      <dl className="flex flex-col gap-2 rounded-lg bg-surface px-4 py-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-hs-black">
            {t("priceTimesDays", { price: money(riderDailyPrice(booking.host_daily_price)), count: booking.days })}
          </dt>
          <dd className="text-hs-black">{money(price.total)}</dd>
        </div>
        <p className="text-xs text-muted">{t("feeIncludedLine", { percent: PLATFORM_FEE_PERCENT, fee: money(price.fee) })}</p>
        <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
          <dt className="text-hs-black">{t("total")}</dt>
          <dd className="text-hs-black">{money(price.total)}</dd>
        </div>
      </dl>

      <p className="rounded-md border border-line px-4 py-3 text-sm text-hs-black">{t("cancelPolicy")}</p>

      {booking.status === "accepted" ? (
        <PaymentForm bookingId={booking.id} total={price.total} />
      ) : (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {t("notAvailable")}
        </p>
      )}
    </div>
  );
}
