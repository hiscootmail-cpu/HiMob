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
  /** Unidades à venda (itens limitados, por temporada). 0 = esgotado. */
  stock: number;
  /** Tamanhos que a pessoa escolhe (ex.: P, M, G). Vazio = sem tamanho. O estoque é um só. */
  sizes: string[];
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
  productStock: 100000,
  /** Até 10 unidades de cada produto por pedido. */
  perItem: 10,
  shippingPrice: 10000,
  /** Até 10 tamanhos por produto, cada um com até 10 letras. */
  sizes: 10,
  sizeLength: 10,
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

// -----------------------------------------------------------------------------
// Compra na loja (decisões de 20/10/2026): qualquer pessoa compra, com ou sem
// conta, e paga por PIX. Frete com valor fixo por região, cadastrado pela equipe.
// -----------------------------------------------------------------------------

export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export type ShippingRate = { id: string; state: string; city: string | null; price: number };

export type CartLine = { id: string; quantity: number; size?: string };

/** Mesma linha do carrinho: mesmo produto e mesmo tamanho. */
export const sameLine = (a: Pick<CartLine, "id" | "size">, b: Pick<CartLine, "id" | "size">) =>
  a.id === b.id && (a.size ?? "") === (b.size ?? "");

/** "P, M, G" ou "P M G" → ["P", "M", "G"] (sem repetir). null se algum tamanho for inválido. */
export function parseSizes(input: string): string[] | null {
  // Só letras e números contam como tamanho ("P - M" vira P e M).
  const list = [...new Set(input.split(/[,;\s/|-]+/).map((v) => v.trim().toUpperCase()).filter((v) => /^[A-Z0-9]+$/.test(v)))];
  if (list.length > WORLD_LIMITS.sizes || list.some((v) => v.length > WORLD_LIMITS.sizeLength)) return null;
  return list;
}

export type OrderStatus = "pending" | "paid" | "shipped" | "canceled" | "refunded";

export type StoreOrder = {
  id: string;
  code: string;
  status: OrderStatus;
  status_reason: string | null;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  buyer_cpf: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  state: string;
  subtotal: number;
  shipping: number;
  total: number;
  tracking_code: string | null;
  pix_code: string | null;
  pix_qr_base64: string | null;
  expires_at: string;
  created_at: string;
  items: { name: string; price: number; quantity: number; size: string | null }[];
};

export type CheckoutField =
  | "name" | "email" | "phone" | "cpf" | "cep" | "street" | "number" | "complement" | "district" | "city" | "state";

export type BuyerData = Record<CheckoutField, string>;

const digits = (value: string) => value.replace(/\D/g, "");

/** CPF com os dois dígitos verificadores certos. */
export function validCpf(value: string): boolean {
  const cpf = digits(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

/** Confere os dados de quem compra; devolve os campos com problema. */
export function checkBuyer(data: BuyerData): CheckoutField[] {
  const bad: CheckoutField[] = [];
  const len = (v: string, min: number, max: number) => v.trim().length >= min && v.trim().length <= max;
  if (!len(data.name, 3, 120) || !data.name.trim().includes(" ")) bad.push("name");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email.trim()) || data.email.length > 200) bad.push("email");
  if (!/^\d{10,11}$/.test(digits(data.phone))) bad.push("phone");
  if (!validCpf(data.cpf)) bad.push("cpf");
  if (!/^\d{8}$/.test(digits(data.cep))) bad.push("cep");
  if (!len(data.street, 2, 150)) bad.push("street");
  if (!len(data.number, 1, 20)) bad.push("number");
  if (data.complement.length > 80) bad.push("complement");
  if (!len(data.district, 2, 80)) bad.push("district");
  if (!len(data.city, 2, 80)) bad.push("city");
  if (!(BR_STATES as readonly string[]).includes(data.state)) bad.push("state");
  return bad;
}

/** Dados como o banco guarda (só números em telefone, CPF e CEP). */
export function cleanBuyer(data: BuyerData): BuyerData {
  return {
    ...data,
    name: data.name.trim(),
    email: data.email.trim().toLowerCase(),
    phone: digits(data.phone),
    cpf: digits(data.cpf),
    cep: digits(data.cep),
  };
}

/** 13010-000 */
export function formatCep(value: string) {
  const d = digits(value);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : value;
}
