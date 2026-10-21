"use client";

import { Plane } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { startTransition, useActionState, useState, useTransition } from "react";

import { endTravel, saveTravel, type TravelState } from "@/app/rider/travel-actions";
import { CityField } from "@/components/city-field";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cityLabel } from "@/lib/br-cities";

type Travel = { city: string; uf: string; until: string };

/**
 * "Estou em viagem" na aba Rider (decisão de 21/10/2026): cidade e data de
 * volta. Enquanto vale, o Explorar abre na cidade da viagem.
 */
export function TravelCard({ travel, today, maxDay }: { travel: Travel | null; today: string; maxDay: string }) {
  const t = useTranslations("rider.travel");
  const tErrors = useTranslations("auth.errors");
  const format = useFormatter();
  const [state, action, pending] = useActionState(saveTravel, {} as TravelState);
  const [ending, startEnding] = useTransition();
  // Formulário aberto a partir de qual resposta: uma viagem salva depois disso fecha o formulário.
  // (O servidor atualiza a tela sozinho depois de salvar.)
  const [openedAt, setOpenedAt] = useState<TravelState | null>(null);
  const editing = openedAt !== null && !(state.done && state !== openedAt);
  const setEditing = (open: boolean) => setOpenedAt(open ? state : null);

  const untilText = (day: string) => format.dateTime(new Date(`${day}T12:00:00`), { day: "numeric", month: "long" });

  if (!editing) {
    return (
      <section aria-labelledby="travel-title" className="flex flex-col gap-3 rounded-lg border border-line bg-hs-white p-4 sm:flex-row sm:items-center">
        <Plane aria-hidden className="size-6 shrink-0 text-hs-black" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="travel-title" className="text-base font-semibold text-hs-black">
            {travel ? t("activeTitle", { city: cityLabel(travel) }) : t("title")}
          </h2>
          <p className="text-sm text-muted">
            {travel ? t("activeText", { until: untilText(travel.until) }) : t("text")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {travel ? (
            <>
              <Button asChild size="sm">
                <Link href="/">{t("explore")}</Link>
              </Button>
              <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                {t("change")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                loading={ending}
                onClick={() =>
                  startEnding(async () => {
                    await endTravel();
                  })
                }
              >
                {t("end")}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              {t("start")}
            </Button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="travel-form-title" className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex items-center gap-3">
        <Plane aria-hidden className="size-6 shrink-0 text-hs-black" />
        <h2 id="travel-form-title" className="text-base font-semibold text-hs-black">
          {t("formTitle")}
        </h2>
      </div>
      <form
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          startTransition(() => action(formData));
        }}
      >
        <CityField
          name="travelCity"
          label={t("city")}
          defaultValue={travel ? { city: travel.city, uf: travel.uf } : null}
          error={state.errors?.city ? tErrors(state.errors.city) : undefined}
        />
        <TextField
          name="until"
          type="date"
          label={t("until")}
          min={today}
          max={maxDay}
          defaultValue={travel?.until ?? ""}
          hint={t("untilHint")}
          error={state.errors?.until ? t(`errors.${state.errors.until}`) : undefined}
        />
        {state.error ? (
          <p role="alert" className="text-sm text-error">
            {tErrors("unexpected")}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setEditing(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" loading={pending}>
            {t("save")}
          </Button>
        </div>
      </form>
    </section>
  );
}
