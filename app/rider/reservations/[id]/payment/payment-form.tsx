"use client";

import { useActionState, useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { payBooking, type PaymentMethod, type PaymentState } from "@/app/rider/reservations/actions";
import { QrCodeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaymentFormProps = {
  bookingId: string;
  total: number;
};

/**
 * Escolha do meio de pagamento (tela 4 do PDF): PIX ou cartão de crédito.
 * Os dados do cartão serão digitados no formulário seguro do Mercado Pago
 * (Payment Brick), que entra no lugar do quadro informativo abaixo.
 */
export function PaymentForm({ bookingId, total }: PaymentFormProps) {
  const t = useTranslations("rider.payment");
  const format = useFormatter();
  const [method, setMethod] = useState<PaymentMethod>("pix");
  const [state, action, pending] = useActionState(payBooking.bind(null, bookingId), {} as PaymentState);

  const options: { value: PaymentMethod; title: string; hint: string; icon: React.ReactNode }[] = [
    { value: "pix", title: t("pix"), hint: t("pixHint"), icon: <QrCodeIcon className="size-6" /> },
    { value: "card", title: t("card"), hint: t("cardHint"), icon: <CreditCard className="size-6" aria-hidden /> },
  ];

  return (
    <form action={action} className="flex flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-3">
        <legend className="mb-1 text-base font-semibold text-hs-black">{t("methodTitle")}</legend>
        {options.map((option) => {
          const checked = method === option.value;
          return (
            <label
              key={option.value}
              className={cn(
                "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-hs-blue/40",
                checked ? "border-hs-green bg-green-soft" : "border-line bg-hs-white hover:bg-surface",
              )}
            >
              <input
                type="radio"
                name="method"
                value={option.value}
                checked={checked}
                onChange={() => setMethod(option.value)}
                className="size-5 accent-hs-green"
              />
              <span className="text-hs-black">{option.icon}</span>
              <span className="flex flex-col">
                <span className="text-base font-semibold text-hs-black">{option.title}</span>
                <span className="text-sm text-muted">{option.hint}</span>
              </span>
            </label>
          );
        })}
      </fieldset>

      {method === "card" ? (
        <div className="flex gap-3 rounded-md border border-dashed border-line bg-surface p-4">
          <ShieldCheck className="size-5 shrink-0 text-on-blue" aria-hidden />
          <p className="text-sm text-hs-black">{t("cardSecure")}</p>
        </div>
      ) : (
        <div className="flex gap-3 rounded-md border border-dashed border-line bg-surface p-4">
          <ShieldCheck className="size-5 shrink-0 text-on-blue" aria-hidden />
          <p className="text-sm text-hs-black">{t("pixInfo")}</p>
        </div>
      )}

      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t("pay", { total: format.number(total, { style: "currency", currency: "BRL" }) })}
      </Button>
      <p className="text-center text-xs text-muted">{t("splitInfo")}</p>
    </form>
  );
}
