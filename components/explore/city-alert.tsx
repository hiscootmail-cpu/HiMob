"use client";

import { BellRing } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { startTransition, useActionState } from "react";

import { requestCityAlert, type CityAlertState } from "@/app/city-alert-actions";
import { CityField } from "@/components/city-field";
import { Button } from "@/components/ui/button";
import type { ChosenCity } from "@/lib/br-cities";

/**
 * Cidade sem oferta (decisão de 22/10/2026): a pessoa pede para ser avisada
 * quando tiver equipamento na cidade. Sem conta, vai para o cadastro.
 */
export function CityAlert({ signedIn, city = null }: { signedIn: boolean; city?: ChosenCity | null }) {
  const t = useTranslations("cityAlert");
  const tErrors = useTranslations("auth.errors");
  const [state, action, pending] = useActionState(requestCityAlert, {} as CityAlertState);

  if (state.done) {
    return (
      <p role="status" className="rounded-md bg-green-soft px-4 py-3 text-sm text-on-green">
        {t("done", { city: state.done })}
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-md border border-line bg-surface p-4 text-left">
      <p className="flex items-center gap-2 text-sm font-semibold text-hs-black">
        <BellRing aria-hidden className="size-4" />
        {t("title")}
      </p>
      <p className="text-sm text-muted">{t("text")}</p>
      {signedIn ? (
        <form
          noValidate
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => action(formData));
          }}
        >
          <CityField
            name="alertCity"
            label={t("cityLabel")}
            defaultValue={city}
            error={state.error && state.error !== "unexpected" ? tErrors(state.error) : undefined}
          />
          {state.error === "unexpected" ? (
            <p role="alert" className="text-sm text-error">
              {tErrors("unexpected")}
            </p>
          ) : null}
          <Button type="submit" loading={pending} className="w-full sm:w-fit">
            {t("submit")}
          </Button>
        </form>
      ) : (
        <Button asChild className="w-full sm:w-fit">
          <Link href="/auth/sign-up">{t("signUp")}</Link>
        </Button>
      )}
    </div>
  );
}
