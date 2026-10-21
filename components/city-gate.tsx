"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useEffect } from "react";

import { saveCities, type CitiesState } from "@/app/profile/actions";
import { CityField } from "@/components/city-field";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

/**
 * Quem já tinha conta escolhe a cidade onde mora (e, se quiser, a secundária)
 * antes de continuar (decisão de 21/10/2026). Tela curta, por cima do site.
 */
export function CityGate() {
  const t = useTranslations("cityGate");
  const tErrors = useTranslations("auth.errors");
  const [state, action, pending] = useActionState(saveCities, {} as CitiesState);
  const router = useRouter();
  useEffect(() => {
    if (state.done) router.refresh();
  }, [state.done, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-hs-black/60 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="city-gate-title"
        className="flex w-full max-w-md flex-col gap-5 rounded-t-2xl bg-hs-white p-6 text-hs-black sm:rounded-2xl"
      >
        <Logo />
        <div className="flex flex-col gap-1">
          <h2 id="city-gate-title" className="text-xl font-bold text-hs-black">
            {t("title")}
          </h2>
          <p className="text-base text-muted">{t("text")}</p>
        </div>
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => action(formData));
          }}
        >
          <CityField
            name="city"
            label={t("city")}
            error={state.errors?.city ? tErrors(state.errors.city) : undefined}
          />
          <CityField
            name="secondCity"
            label={t("secondCity")}
            hint={t("secondCityHint")}
            error={state.errors?.secondCity ? tErrors(state.errors.secondCity) : undefined}
          />
          {state.error ? (
            <p role="alert" className="text-sm text-error">
              {tErrors("unexpected")}
            </p>
          ) : null}
          <Button type="submit" size="lg" loading={pending || Boolean(state.done)} className="w-full">
            {t("save")}
          </Button>
        </form>
      </div>
    </div>
  );
}
