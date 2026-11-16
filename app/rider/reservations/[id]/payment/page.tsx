import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Deadline } from "@/components/bookings/deadline";
import { BackLink } from "@/components/rider/back-link";
import { BookingSummary } from "@/components/rider/booking-summary";
import { bookingPrice } from "@/lib/bookings";
import { getRiderBooking } from "@/lib/bookings-db";
import { durationText } from "@/lib/duration";
import { pendingPix } from "@/lib/mercadopago/booking-payments";
import { mercadoPagoOn } from "@/lib/mercadopago/server";
import { methodEnabled } from "@/lib/payment-split";
import { breakdownFromHost, CURRENT_FEE_MODEL, PLATFORM_FEE_PERCENT } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";
import { MercadoPagoPayment } from "./mercado-pago-payment";
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
  const tDuration = await getTranslations("duration");
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const price = bookingPrice(booking);
  // Mercado Pago ligado: formulário seguro (PIX ou cartão à vista). Antes disso, o pagamento de teste.
  const mpOn = booking.status === "accepted" && (await mercadoPagoOn());
  const [user, initialPix] = mpOn ? await Promise.all([getCurrentUser(), pendingPix(booking.id)]) : [null, null];

  // Preço cheio (sem cupom) para mostrar aluguel e taxa separados.
  const full = breakdownFromHost(booking.host_amount, booking.fee_model ?? CURRENT_FEE_MODEL);

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
            {t("rentalOf", { duration: durationText(tDuration, booking.hours) })}
          </dt>
          <dd className="text-hs-black">{money(full.listed)}</dd>
        </div>
        {full.riderFee > 0 ? (
          <div className="flex justify-between gap-3">
            <dt className="text-hs-black">{t("serviceFeeLine", { percent: PLATFORM_FEE_PERCENT })}</dt>
            <dd className="text-hs-black">{money(full.riderFee)}</dd>
          </div>
        ) : (
          // Reserva feita antes da taxa nova: só os 15% do Host, já no preço.
          <p className="text-xs text-muted">{t("feeIncludedLine", { percent: PLATFORM_FEE_PERCENT, fee: money(full.fee) })}</p>
        )}
        {price.rentalDiscount + price.feeDiscount > 0 ? (
          <div className="flex justify-between gap-3 text-on-green">
            <dt>{t("couponDiscount", { code: booking.coupon_code ?? "" })}</dt>
            <dd className="whitespace-nowrap">- {money(price.rentalDiscount + price.feeDiscount)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3 border-t border-line pt-2 text-base font-bold">
          <dt className="text-hs-black">{t("total")}</dt>
          <dd className="text-hs-black">{money(price.total)}</dd>
        </div>
      </dl>

      <p className="rounded-md border border-line px-4 py-3 text-sm text-hs-black">{t("cancelPolicy")}</p>

      {booking.status === "accepted" && booking.pay_by ? <Deadline until={booking.pay_by} kind="pay" /> : null}
      {booking.status === "accepted" && mpOn ? (
        <MercadoPagoPayment
          bookingId={booking.id}
          total={price.total}
          payerEmail={user?.email ?? ""}
          pixEnabled={methodEnabled("pix")}
          initialPix={initialPix}
        />
      ) : booking.status === "accepted" ? (
        <PaymentForm bookingId={booking.id} total={price.total} />
      ) : (
        <p role="status" className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          {t("notAvailable")}
        </p>
      )}
    </div>
  );
}
