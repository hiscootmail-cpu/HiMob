import "server-only";

import type { LatLng } from "@/lib/geo";

/*
 * Localização do anúncio a partir do endereço de retirada, quando o Host não
 * usa "Usar minha localização" (decisão de 20/10/2026: marcar no mapa é
 * opcional). Usa o buscador do OpenStreetMap (Nominatim), sem chave. O mapa
 * público mostra só a região (o banco arredonda o ponto), nunca o endereço.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/search";

async function search(query: string): Promise<LatLng | null> {
  const url = `${NOMINATIM}?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(query)}`;
  try {
    const response = await fetch(url, {
      // O Nominatim pede que cada site se identifique.
      headers: { "User-Agent": "HiScoot/1.0 (https://hi-mob.vercel.app)", "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    const [first] = (await response.json()) as { lat?: string; lon?: string }[];
    const latitude = Number(first?.lat);
    const longitude = Number(first?.lon);
    return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
  } catch {
    return null;
  }
}

/** Tenta o endereço completo; se não achar, o bairro; por fim, só a cidade. */
export async function locateAddress({ address, area, city }: { address: string; area: string; city: string }): Promise<LatLng | null> {
  const attempts = [`${address}, ${area}, ${city}`, `${area}, ${city}`, city].map((q) => `${q}, Brasil`);
  for (const query of attempts) {
    const found = await search(query);
    if (found) return found;
  }
  return null;
}
