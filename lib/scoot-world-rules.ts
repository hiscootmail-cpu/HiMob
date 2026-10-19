/*
 * Mundo Scoot (decisões de 19/10/2026): aba aberta a todas as pessoas, com ou
 * sem cadastro. Loja interna (por enquanto só vitrine), HiTV (vídeos do
 * YouTube), lojas parceiras e oficinas credenciadas (campos básicos).
 * Só a equipe cadastra. Este arquivo pode ser usado no navegador e no servidor.
 */

export type WorldProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  /** Endereço público da foto (pasta "world-photos"). */
  photo?: string;
  photo_path?: string | null;
  active: boolean;
};

export type WorldVideo = {
  id: string;
  title: string;
  /** Código do vídeo no YouTube (11 caracteres). */
  youtube_id: string;
  active: boolean;
};

export type WorldPlaceKind = "partner" | "workshop";

export type WorldPlace = {
  id: string;
  kind: WorldPlaceKind;
  name: string;
  address: string;
  city: string;
  /** Só números, com DDD. */
  phone: string | null;
  services: string;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
};

/** Os mesmos limites do banco (supabase/migrations/20261020120000_mundo_scoot.sql). */
export const WORLD_LIMITS = {
  productName: { min: 2, max: 80 },
  productDescription: 1000,
  productPrice: 100000,
  videoTitle: { min: 2, max: 100 },
  placeName: { min: 2, max: 80 },
  placeAddress: { min: 5, max: 200 },
  placeCity: { min: 2, max: 80 },
  placeServices: 300,
} as const;

/**
 * Código do vídeo a partir do que a equipe colar: o endereço do YouTube
 * (watch?v=, youtu.be, shorts, embed, live) ou o próprio código.
 */
export function youtubeId(input: string): string | null {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www|m|music)\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const [, first, second] = url.pathname.split("/");
    id = first === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live"].includes(first) ? second : null;
  }
  return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
}

/** Endereço para assistir dentro do site, sem cookies de propaganda até a pessoa dar play. */
export function youtubeEmbedUrl(id: string) {
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

export function youtubeThumbnail(id: string) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Abre a rota no OpenStreetMap (sem precisar de chave). */
export function placeMapUrl(place: Pick<WorldPlace, "latitude" | "longitude" | "address" | "city">) {
  return place.latitude !== null && place.longitude !== null
    ? `https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=17/${place.latitude}/${place.longitude}`
    : `https://www.openstreetmap.org/search?query=${encodeURIComponent(`${place.address}, ${place.city}`)}`;
}

/** (19) 99999-0000 */
export function formatPhone(digits: string) {
  const d = digits.replace(/\D/g, "");
  if (d.length < 10) return digits;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}
