import "server-only";

import { createClient } from "@/lib/supabase/server";

/*
 * Estado e país de cada cidade com anúncio (decisão de 21/10/2026), para o
 * filtro do Painel → Operação. O site descobre sozinho pelo ponto do anúncio no
 * mapa (OpenStreetMap, sem chave) e guarda; o Host não digita nada a mais.
 */

export type Place = {
  city: string;
  state: string | null;
  state_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
};

const NOMINATIM_REVERSE = "https://nominatim.openstreetmap.org/reverse";
/** O Nominatim pede no máximo 1 consulta por segundo; poucas por visita ao painel. */
const PER_VISIT = 3;

type Found = { state: string | null; state_code: string | null; country: string };

async function regionAt(latitude: number, longitude: number): Promise<Found | null> {
  const url = `${NOMINATIM_REVERSE}?format=jsonv2&zoom=10&addressdetails=1&lat=${latitude}&lon=${longitude}`;
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "HiScoot/1.0 (https://hi-mob.vercel.app)", "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const { address } = (await response.json()) as { address?: Record<string, string> };
    const country = address?.country_code?.toUpperCase();
    if (!country || !/^[A-Z]{2}$/.test(country)) return null;
    // Ex.: "BR-SP" → "SP".
    const iso = address?.["ISO3166-2-lvl4"]?.split("-")[1]?.toUpperCase();
    return {
      state: address?.state?.slice(0, 80) ?? null,
      state_code: iso && /^[A-Z0-9]{1,4}$/.test(iso) ? iso : null,
      country,
    };
  } catch {
    return null;
  }
}

/** Cidades com anúncio aprovado. As que ainda não têm região são descobertas aos poucos. */
export async function listPlaces(): Promise<Place[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_places");
  const places = (data ?? []) as Place[];
  const missing = places.filter((p) => !p.country && p.latitude !== null && p.longitude !== null).slice(0, PER_VISIT);
  for (const [index, place] of missing.entries()) {
    if (index) await new Promise((resolve) => setTimeout(resolve, 1100));
    const found = await regionAt(place.latitude as number, place.longitude as number);
    if (!found) continue;
    const { data: key } = await supabase.rpc("city_key", { p_city: place.city });
    const { error } = await supabase.from("city_regions").insert({ city_key: key, city: place.city.trim(), ...found });
    if (!error) Object.assign(place, found);
  }
  return places;
}
