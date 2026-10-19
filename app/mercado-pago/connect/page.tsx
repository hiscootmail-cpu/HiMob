import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { startMercadoPagoConnect } from "@/app/mercado-pago/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { CheckCircleIcon, WalletIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { mercadoPagoConnected } from "@/lib/mercadopago/server";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mercadoPago.connect");
  return { title: t("title") };
}

/**
 * Conectar a conta Mercado Pago: só o Host, que recebe o pagamento das reservas
 * direto na conta dele (decisão de 20/10/2026). Quem só paga não precisa.
 */
export default async function MercadoPagoConnectPage({ searchParams }: PageProps<"/mercado-pago/connect">) {
  if (!supabaseConfigured()) redirect("/dashboard");
  await requireUser();
  if (await mercadoPagoConnected()) redirect("/dashboard");
  const t = await getTranslations("mercadoPago.connect");
  const { error } = await searchParams;
  const reasons = ["receive", "safe", "once"] as const;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col px-4 py-10 sm:px-6">
      <AuthCard title={t("title")} description={t("description")} icon={<WalletIcon className="size-12" />}>
        <ul className="flex flex-col gap-3">
          {reasons.map((key) => (
            <li key={key} className="flex gap-3 text-sm text-hs-black">
              <CheckCircleIcon className="size-5 shrink-0 text-on-green" />
              {t(`reasons.${key}`)}
            </li>
          ))}
        </ul>
        {error ? (
          <p role="alert" className="rounded-md border border-error-line bg-error-soft p-3 text-sm text-error">
            {t(error === "unavailable" ? "errors.unavailable" : "errors.failed")}
          </p>
        ) : null}
        <form action={startMercadoPagoConnect}>
          <Button type="submit" size="lg" className="w-full">
            {t("button")}
          </Button>
        </form>
        <p className="text-xs text-muted">{t("noAccount")}</p>
      </AuthCard>
    </div>
  );
}
