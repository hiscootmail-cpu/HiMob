"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useTranslations } from "next-intl";

import { placeMapUrl, type WorldPlace } from "@/lib/scoot-world-rules";

type Located = WorldPlace & { latitude: number; longitude: number };

/** Enquadra o mapa para mostrar todos os locais. */
function FitToPlaces({ places }: { places: Located[] }) {
  const map = useMap();
  const key = places.map((p) => `${p.latitude},${p.longitude}`).join("|");

  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (places.length === 1) {
        map.setView([places[0].latitude, places[0].longitude], 15, { animate: false });
        return;
      }
      const bounds = L.latLngBounds(places.map((p) => [p.latitude, p.longitude] as [number, number]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 15, animate: false });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(map.getContainer());
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "key" resume os pontos
  }, [map, key]);
  return null;
}

/** Pino colorido: azul para loja parceira, verde para oficina. */
function placePin(kind: WorldPlace["kind"]) {
  const tone = kind === "workshop" ? "bg-hs-green" : "bg-hs-blue";
  return L.divIcon({
    className: "",
    html: `<span class="block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-hs-white shadow-md ${tone}"></span>`,
    iconSize: [0, 0],
  });
}

/** Mapa do OpenStreetMap com as lojas parceiras e as oficinas credenciadas. */
export default function PlacesMap({ places }: { places: Located[] }) {
  const t = useTranslations("scootWorld.places");
  const tExplore = useTranslations("explore");
  const attribution = useMemo(
    () => `&copy; <a href="https://www.openstreetmap.org/copyright">${tExplore("mapAttribution")}</a>`,
    [tExplore],
  );

  return (
    <MapContainer
      center={[places[0].latitude, places[0].longitude]}
      zoom={13}
      scrollWheelZoom={false}
      className="size-full bg-surface"
      aria-label={t("mapLabel")}
    >
      <TileLayer attribution={attribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToPlaces places={places} />
      {places.map((place) => (
        <Marker key={place.id} position={[place.latitude, place.longitude]} icon={placePin(place.kind)} alt={place.name} keyboard>
          <Popup>
            <span className="flex flex-col gap-1 font-sans">
              <span className="text-xs font-semibold text-muted">{t(`kind.${place.kind}`)}</span>
              <span className="text-sm font-semibold text-hs-black">{place.name}</span>
              <span className="text-xs text-hs-black">{place.address}</span>
              <a href={placeMapUrl(place)} target="_blank" rel="noreferrer" className="text-sm font-semibold text-on-blue underline">
                {t("route")}
              </a>
            </span>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
