"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import { useTranslations } from "next-intl";

import { FALLBACK_LOCATION } from "@/lib/equipment";
import type { LatLng } from "@/lib/geo";

const pin = L.divIcon({
  className: "",
  html: '<span class="block size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-hs-white bg-hs-black shadow-md"></span>',
  iconSize: [0, 0],
});

function ClickToPlace({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({
    click: (event) =>
      onPick({ latitude: Math.round(event.latlng.lat * 1e6) / 1e6, longitude: Math.round(event.latlng.lng * 1e6) / 1e6 }),
  });
  return null;
}

/** A equipe toca no mapa para marcar onde fica a loja ou a oficina. */
export default function LocationPicker({ value, onPick }: { value: LatLng | null; onPick: (point: LatLng) => void }) {
  const t = useTranslations("adminWorld.places");
  const tExplore = useTranslations("explore");
  const center = value ?? FALLBACK_LOCATION;

  return (
    <MapContainer center={[center.latitude, center.longitude]} zoom={value ? 16 : 12} className="size-full bg-surface" aria-label={t("mapLabel")}>
      <TileLayer
        attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">${tExplore("mapAttribution")}</a>`}
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickToPlace onPick={onPick} />
      {value ? <Marker position={[value.latitude, value.longitude]} icon={pin} interactive={false} /> : null}
    </MapContainer>
  );
}
