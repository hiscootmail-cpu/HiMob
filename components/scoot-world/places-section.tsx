"use client";

import dynamic from "next/dynamic";
import { Phone } from "lucide-react";
import { useTranslations } from "next-intl";

import { MapPinIcon } from "@/components/icons";
import { formatPhone, placeMapUrl, type WorldPlace } from "@/lib/scoot-world-rules";
import { cn } from "@/lib/utils";

// O mapa só existe no navegador (Leaflet usa a janela do navegador).
const PlacesMap = dynamic(() => import("@/components/scoot-world/places-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-line" />,
});

function PlaceList({ kind, places }: { kind: WorldPlace["kind"]; places: WorldPlace[] }) {
  const t = useTranslations("scootWorld.places");
  const items = places.filter((p) => p.kind === kind);

  return (
    <section id={kind === "partner" ? "partners" : "workshops"} className="flex flex-col gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-hs-black">
        <span aria-hidden className={cn("size-3 rounded-full", kind === "workshop" ? "bg-hs-green" : "bg-hs-blue")} />
        {t(kind === "partner" ? "partnersTitle" : "workshopsTitle")}
      </h2>
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          {t(kind === "partner" ? "partnersEmpty" : "workshopsEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((place) => (
            <li key={place.id} className="flex flex-col gap-2 rounded-lg border border-line bg-hs-white p-4">
              <p className="text-base font-semibold text-hs-black">{place.name}</p>
              <p className="flex items-start gap-2 text-sm text-hs-black">
                <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  {place.address} · {place.city}
                </span>
              </p>
              {place.services ? <p className="text-sm text-muted">{place.services}</p> : null}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {place.phone ? (
                  <a href={`tel:+55${place.phone}`} className="inline-flex items-center gap-1.5 font-semibold text-hs-black underline underline-offset-2">
                    <Phone className="size-4" />
                    {formatPhone(place.phone)}
                  </a>
                ) : null}
                <a href={placeMapUrl(place)} target="_blank" rel="noreferrer" className="font-semibold text-on-blue underline underline-offset-2">
                  {t("route")}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Lojas parceiras e oficinas credenciadas: mapa em cima, listas embaixo. */
export function PlacesSection({ places }: { places: WorldPlace[] }) {
  const located = places.filter(
    (p): p is WorldPlace & { latitude: number; longitude: number } => p.latitude !== null && p.longitude !== null,
  );

  return (
    <div className="flex flex-col gap-6">
      {located.length ? (
        <div className="h-72 overflow-hidden rounded-lg border border-line sm:h-96">
          <PlacesMap places={located} />
        </div>
      ) : null}
      <div className="grid gap-6 md:grid-cols-2">
        <PlaceList kind="partner" places={places} />
        <PlaceList kind="workshop" places={places} />
      </div>
    </div>
  );
}
