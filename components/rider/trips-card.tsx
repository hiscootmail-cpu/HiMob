"use client";

import { Pencil, Plane, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { startTransition, useActionState, useState, useTransition } from "react";

import { deleteTrip, saveTrip, type TravelState } from "@/app/rider/travel-actions";
import { CityField } from "@/components/city-field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { cityLabel } from "@/lib/br-cities";
import { cn } from "@/lib/utils";

type TripWants = "scooter" | "ebike" | "both";
type Trip = { id: string; city: string; uf: string; from: string; until: string; wants: TripWants };

const WANTS: TripWants[] = ["scooter", "ebike", "both"];

/**
 * Minhas viagens na aba Rider (decisões de 21 e 22/10/2026): várias viagens
 * marcadas, sem cruzar datas, com o que a pessoa pretende usar. Da ida até a
 * volta, o Explorar abre na cidade da viagem.
 */
export function TripsCard({ trips, today, maxDay, maxTrips }: { trips: Trip[]; today: string; maxDay: string; maxTrips: number }) {
  const t = useTranslations("rider.travel");
  const tErrors = useTranslations("auth.errors");
  const format = useFormatter();
  const [state, action, pending] = useActionState(saveTrip, {} as TravelState);
  const [deleting, startDeleting] = useTransition();
  // Formulário aberto ("new" ou o id da viagem) e a resposta que havia quando abriu:
  // uma viagem salva depois disso fecha o formulário (o servidor atualiza a lista).
  const [open, setOpen] = useState<{ target: string; at: TravelState } | null>(null);
  const editing = open && !(state.done && state !== open.at) ? open.target : null;
  const editingTrip = trips.find((trip) => trip.id === editing) ?? null;
  const [from, setFrom] = useState(today);
  const [wants, setWants] = useState<TripWants | "">("");

  const startEdit = (target: string) => {
    const trip = trips.find((item) => item.id === target);
    setFrom(trip?.from ?? today);
    setWants(trip?.wants ?? "");
    setOpen({ target, at: state });
  };

  const day = (value: string) => format.dateTime(new Date(`${value}T12:00:00`), { day: "numeric", month: "short" });

  return (
    <section aria-labelledby="trips-title" className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex flex-wrap items-start gap-3">
        <Plane aria-hidden className="mt-0.5 size-6 shrink-0 text-hs-black" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h2 id="trips-title" className="text-base font-semibold text-hs-black">
            {t("title")}
          </h2>
          <p className="text-sm text-muted">{t("text")}</p>
        </div>
        {editing === null && trips.length < maxTrips ? (
          <Button variant="outline" size="sm" onClick={() => startEdit("new")}>
            <Plus aria-hidden />
            {t("add")}
          </Button>
        ) : null}
      </div>

      {trips.length ? (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {trips.map((trip) => {
            const now = trip.from <= today && today <= trip.until;
            return (
              <li key={trip.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-hs-black">
                    {cityLabel(trip)}
                    <Badge tone={now ? "success" : "info"}>{now ? t("now") : t("planned")}</Badge>
                  </p>
                  <p className="text-sm text-muted">
                    {t("dates", { from: day(trip.from), until: day(trip.until) })} · {t(`wants.${trip.wants}`)}
                  </p>
                </div>
                <div className="flex gap-1">
                  {now ? (
                    <Button asChild size="sm">
                      <Link href="/">{t("explore")}</Link>
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => startEdit(trip.id)} aria-label={t("editTrip", { city: trip.city })}>
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={deleting}
                    aria-label={t("deleteTrip", { city: trip.city })}
                    onClick={() => startDeleting(async () => deleteTrip(trip.id))}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : editing === null ? (
        <p className="rounded-md border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{t("empty")}</p>
      ) : null}

      {editing !== null ? (
        <form
          key={editing}
          noValidate
          className="flex flex-col gap-4 rounded-md bg-surface p-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => action(formData));
          }}
        >
          <p className="text-sm font-semibold text-hs-black">{editingTrip ? t("formEdit") : t("formNew")}</p>
          <input type="hidden" name="tripId" value={editingTrip?.id ?? ""} />
          <CityField
            name="travelCity"
            label={t("city")}
            defaultValue={editingTrip ? { city: editingTrip.city, uf: editingTrip.uf } : null}
            error={state.errors?.city && state !== open?.at ? t(`errors.${state.errors.city}`) : undefined}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              name="from"
              type="date"
              label={t("from")}
              min={editingTrip && editingTrip.from < today ? editingTrip.from : today}
              max={maxDay}
              value={from}
              onChange={(event) => setFrom(event.currentTarget.value)}
              error={state.errors?.from && state !== open?.at ? t(`errors.${state.errors.from}`) : undefined}
            />
            <TextField
              name="until"
              type="date"
              label={t("until")}
              min={from && from > today ? from : today}
              defaultValue={editingTrip?.until ?? ""}
              error={state.errors?.until && state !== open?.at ? t(`errors.${state.errors.until}`) : undefined}
            />
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium text-hs-black">{t("wantsLabel")}</legend>
            <div className="flex flex-wrap gap-2">
              {WANTS.map((option) => (
                <label
                  key={option}
                  className={cn(
                    "inline-flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-hs-blue/40",
                    wants === option ? "border-hs-black bg-hs-black text-hs-white" : "border-line bg-hs-white text-hs-black hover:bg-surface",
                  )}
                >
                  <input
                    type="radio"
                    name="wants"
                    value={option}
                    checked={wants === option}
                    onChange={() => setWants(option)}
                    className="sr-only"
                  />
                  {t(`wants.${option}`)}
                </label>
              ))}
            </div>
            {state.errors?.wants && state !== open?.at ? (
              <p role="alert" className="text-sm text-error">
                {t("errors.wantsRequired")}
              </p>
            ) : null}
          </fieldset>
          <p className="text-sm text-muted">{t("datesHint")}</p>
          {state.error && state !== open?.at ? (
            <p role="alert" className="text-sm text-error">
              {state.error === "unexpected" ? tErrors("unexpected") : t(`errors.${state.error}`, { max: maxTrips })}
            </p>
          ) : null}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(null)}>
              {t("cancel")}
            </Button>
            <Button type="submit" loading={pending}>
              {t("save")}
            </Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
