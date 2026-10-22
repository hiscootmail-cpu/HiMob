"use client";

import { useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { checkPayment, payWithMercadoPago } from "@/app/rider/reservations/actions";
import { CheckCircleIcon, QrCodeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import type { BrickFormData, PixData } from "@/lib/mercadopago/booking-payments";
import { MP_PUBLIC_KEY } from "@/lib/mercadopago/config";

/*
 * Formulário seguro do Mercado Pago (Payment Brick): PIX ou cartão de crédito
 * à vista. Os dados do cartão são digitados no formulário do Mercado Pago; a
 * Hi Scoot recebe só um "token" de uso único. O valor é recalculado no servidor.
 */

type Brick = { unmount: () => void };
type MercadoPagoSdk = new (key: string, options: { locale: string }) => {
  bricks: () => { create: (kind: "payment", container: string, settings: unknown) => Promise<Brick> };
};
declare global {
  interface Window {
    MercadoPago?: MercadoPagoSdk;
  }
}

type Props = {
  bookingId: string;
  total: number;
  payerEmail: string;
  pixEnabled: boolean;
  /** PIX gerado antes e ainda esperando pagamento. */
  initialPix: PixData | null;
};

const CONTAINER = "mp-payment-brick";

export function MercadoPagoPayment({ bookingId, total, payerEmail, pixEnabled, initialPix }: Props) {
  const t = useTranslations("rider.payment.mp");
  const locale = useLocale();
  const router = useRouter();
  const [sdkReady, setSdkReady] = useState(false);
  const [pix, setPix] = useState<PixData | null>(initialPix);
  const [error, setError] = useState<"rejected" | "unavailable" | "notAllowed" | "expired" | null>(null);
  const [copied, setCopied] = useState(false);
  const brick = useRef<Brick | null>(null);

  // Formulário do Mercado Pago (só enquanto não há PIX esperando pagamento).
  useEffect(() => {
    if (!sdkReady || pix || !window.MercadoPago) return;
    let cancelled = false;
    const mp = new window.MercadoPago(MP_PUBLIC_KEY, { locale: locale === "en" ? "en-US" : "pt-BR" });
    mp.bricks()
      .create("payment", CONTAINER, {
        initialization: { amount: total, payer: { email: payerEmail } },
        customization: {
          paymentMethods: { creditCard: "all", ...(pixEnabled ? { bankTransfer: ["pix"] } : {}), maxInstallments: 1 },
        },
        callbacks: {
          onReady: () => undefined,
          onError: () => setError("unavailable"),
          onSubmit: ({ formData }: { formData: BrickFormData }) =>
            payWithMercadoPago(bookingId, formData).then((result) => {
              if (result.status === "approved") router.push(`/rider/reservations/${bookingId}/confirmed`);
              else if (result.status === "pending" && result.pix) setPix(result.pix);
              else if (result.status === "pending") setError(null);
              else setError(result.status === "error" ? result.error : "rejected");
            }),
        },
      })
      .then((created) => {
        if (cancelled) created.unmount();
        else brick.current = created;
      });
    return () => {
      cancelled = true;
      brick.current?.unmount();
      brick.current = null;
    };
  }, [sdkReady, pix, total, payerEmail, pixEnabled, bookingId, locale, router]);

  // PIX: a tela pergunta de 5 em 5 segundos se o pagamento já caiu.
  useEffect(() => {
    if (!pix) return;
    const timer = setInterval(async () => {
      if ((await checkPayment(bookingId)) === "approved") router.push(`/rider/reservations/${bookingId}/confirmed`);
    }, 5000);
    return () => clearInterval(timer);
  }, [pix, bookingId, router]);

  return (
    <div className="flex flex-col gap-4">
      <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onReady={() => setSdkReady(true)} />

      {pix ? (
        <section aria-labelledby="pix-title" className="flex flex-col items-center gap-4 rounded-lg border border-line bg-hs-white p-5 text-center">
          <h2 id="pix-title" className="flex items-center gap-2 text-lg font-semibold text-hs-black">
            <QrCodeIcon className="size-6" />
            {t("pixTitle")}
          </h2>
          <p className="text-sm text-hs-black">{t("pixText")}</p>
          {pix.qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagem gerada pelo Mercado Pago (base64)
            <img src={`data:image/png;base64,${pix.qr}`} alt={t("qrAlt")} className="size-56 rounded-md border border-line" />
          ) : null}
          <label className="flex w-full flex-col gap-1.5 text-left">
            <span className="text-sm font-medium text-hs-black">{t("pixCodeLabel")}</span>
            <input
              readOnly
              value={pix.code}
              onFocus={(event) => event.currentTarget.select()}
              className="h-11 w-full rounded-md border border-line bg-surface px-3 text-sm text-hs-black"
            />
          </label>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={async () => {
              await navigator.clipboard.writeText(pix.code).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? <CheckCircleIcon /> : null}
            {copied ? t("pixCopied") : t("pixCopy")}
          </Button>
          <p role="status" className="text-sm font-medium text-hs-black">
            {t("pixWaiting")}
          </p>
          <p className="text-xs text-muted">{t("pixExpires")}</p>
        </section>
      ) : (
        <>
          {!sdkReady ? <p className="text-sm text-muted">{t("loading")}</p> : null}
          <div id={CONTAINER} />
          {!pixEnabled ? <p className="text-xs text-muted">{t("cardOnly")}</p> : null}
        </>
      )}

      {error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${error}`)}
        </p>
      ) : null}
    </div>
  );
}
