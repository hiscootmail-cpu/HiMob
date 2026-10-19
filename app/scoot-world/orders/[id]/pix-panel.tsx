"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { checkOrder } from "@/app/scoot-world/orders/[id]/actions";
import { QrCodeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** QR Code e "copia e cola" do PIX. Pergunta de 5 em 5 segundos se já pagou. */
export function PixPanel({ id, token, code, qr }: { id: string; token: string; code: string; qr: string | null }) {
  const t = useTranslations("scootWorld.order");
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const timer = setInterval(async () => {
      const status = await checkOrder(id, token);
      if (status && status !== "pending") router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [id, token, router]);

  return (
    <section aria-labelledby="pix-title" className="flex flex-col items-center gap-4 rounded-lg border border-line bg-hs-white p-5 text-center">
      <h2 id="pix-title" className="flex items-center gap-2 text-lg font-semibold text-hs-black">
        <QrCodeIcon className="size-6" />
        {t("pixTitle")}
      </h2>
      <p className="text-sm text-hs-black">{t("pixText")}</p>
      {qr ? (
        // QR Code gerado pelo Mercado Pago (imagem em base64).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`data:image/png;base64,${qr}`} alt={t("qrAlt")} className="size-56 rounded-md border border-line" />
      ) : null}
      <label className="flex w-full flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-hs-black">{t("pixCodeLabel")}</span>
        <input
          readOnly
          value={code}
          onFocus={(event) => event.currentTarget.select()}
          className="h-11 w-full rounded-md border border-line bg-surface px-3 font-mono text-xs text-hs-black outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/25"
        />
      </label>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(code).catch(() => undefined);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        }}
      >
        {copied ? t("pixCopied") : t("pixCopy")}
      </Button>
      <p role="status" className="text-sm font-semibold text-hs-black">
        {t("pixWaiting")}
      </p>
      <p className="text-xs text-muted">{t("pixExpires")}</p>
    </section>
  );
}
