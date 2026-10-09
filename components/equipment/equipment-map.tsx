"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { useFormatter, useTranslations } from "next-intl";

import type { Equipment } from "@/lib/equipment";
import type { LatLng } from "@/lib/geo";
import { riderDailyPrice } from "@/lib/pricing";

type EquipmentMapProps = {
  items: Equipment[];
  center: LatLng;
  /** Mostra o ponto azul da pessoa quando ela compartilhou a localização. */
  userLocation: LatLng | null;
  highlightedId: string | null;
  onHover?: (id: string | null) => void;
};

/**
 * Enquadra o mapa para mostrar todos os equipamentos encontrados (e a pessoa,
 * quando ela compartilhou a localização). Refaz quando a lista muda e quando
 * o mapa muda de tamanho (no celular ele pode nascer escondido).
 */
function FitToResults({ points }: { points: LatLng[] }) {
  const map = useMap();
  const key = points.map((p) => `${p.latitude},${p.longitude}`).join("|");

  useEffect(() => {
    const fit = () => {
      map.invalidateSize();
      if (points.length === 0) return;
      if (points.length === 1) {
        map.setView([points[0].latitude, points[0].longitude], 15, { animate: false });
        return;
      }
      const bounds = L.latLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
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

/** Pino com o preço por dia, como em apps de aluguel (Airbnb). */
function pricePin(label: string, highlighted: boolean, available: boolean) {
  const tone = highlighted
    ? "bg-hs-black text-hs-white border-hs-black"
    : available
      ? "bg-hs-white text-hs-black border-hs-black/20"
      : "bg-surface text-muted border-line";
  return L.divIcon({
    className: "",
    html: `<span class="inline-flex -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold shadow-md ${tone}">${label}</span>`,
    iconSize: [0, 0],
  });
}

const userDot = L.divIcon({
  className: "",
  html: '<span class="block size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-hs-white bg-hs-blue shadow-md"></span>',
  iconSize: [0, 0],
});

/** Mapa do OpenStreetMap com os equipamentos (Leaflet). */
export default function EquipmentMap({ items, center, userLocation, highlightedId, onHover }: EquipmentMapProps) {
  const t = useTranslations("explore");
  const format = useFormatter();
  const attribution = useMemo(
    () => `&copy; <a href="https://www.openstreetmap.org/copyright">${t("mapAttribution")}</a>`,
    [t],
  );

  return (
    <MapContainer
      center={[center.latitude, center.longitude]}
      zoom={13}
      scrollWheelZoom
      className="size-full bg-surface"
      aria-label={t("mapLabel")}
    >
      <TileLayer attribution={attribution} url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToResults points={[...items, ...(userLocation ? [userLocation] : [])]} />
      {userLocation ? (
        <Marker position={[userLocation.latitude, userLocation.longitude]} icon={userDot} interactive={false} />
      ) : null}
      {items.map((item) => {
        const price = format.number(riderDailyPrice(item.daily_price), {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        });
        return (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={pricePin(price, item.id === highlightedId, item.is_available)}
            zIndexOffset={item.id === highlightedId ? 1000 : 0}
            eventHandlers={{
              mouseover: () => onHover?.(item.id),
              mouseout: () => onHover?.(null),
            }}
            alt={t("pinLabel", { title: item.title, price })}
            keyboard
          >
            <Popup>
              <span className="flex flex-col gap-1 font-sans">
                <span className="text-sm font-semibold text-hs-black">{item.title}</span>
                <span className="text-xs text-muted">{item.area}</span>
                <Link href={`/equipment/${item.id}`} className="text-sm font-semibold text-on-blue underline">
                  {t("seeDetails")}
                </Link>
              </span>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
