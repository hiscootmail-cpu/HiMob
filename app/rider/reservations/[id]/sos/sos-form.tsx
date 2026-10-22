"use client";

import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { startTransition, useActionState, useState } from "react";

import { reportSos, type SupportState } from "@/app/help/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOPICS = ["accident", "theft", "breakdown", "other"] as const;

/** Avisar a equipe e o Host na hora, com localização opcional. */
export function SosForm({ bookingId }: { bookingId: string }) {
  const t = useTranslations("help.sos");
  const tHelp = useTranslations("help");
  const [state, action, pending] = useActionState(reportSos.bind(null, bookingId), {} as SupportState);
  const [topic, setTopic] = useState<(typeof TOPICS)[number] | "">("");
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  const locate = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPoint({ lat: p.coords.latitude, lng: p.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-semibold text-hs-black">{t("what")}</legend>
        <div className="grid grid-cols-2 gap-2">
          {TOPICS.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-lg border-2 px-3 py-3 text-center text-sm font-semibold has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-hs-blue/40",
                topic === option ? "border-hs-black bg-hs-black text-hs-white" : "border-line bg-hs-white text-hs-black hover:bg-surface",
              )}
            >
              <input type="radio" name="topic" value={option} checked={topic === option} onChange={() => setTopic(option)} className="sr-only" />
              {tHelp(`topics.${option}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-hs-black">
        {t("details")}
        <textarea
          name="message"
          rows={3}
          maxLength={2000}
          placeholder={t("detailsPlaceholder")}
          className="w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25"
        />
      </label>
      <input type="hidden" name="latitude" value={point?.lat ?? ""} />
      <input type="hidden" name="longitude" value={point?.lng ?? ""} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" loading={locating} onClick={locate}>
          <LocateFixed aria-hidden />
          {point ? t("locationOk") : t("location")}
        </Button>
        <span className="text-xs text-muted">{t("locationHint")}</span>
      </div>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {tHelp(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending} className="w-full bg-hs-black text-hs-white hover:brightness-110">
        {t("send")}
      </Button>
    </form>
  );
}
