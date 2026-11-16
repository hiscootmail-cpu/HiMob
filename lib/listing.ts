import { MAX_PHOTOS, MIN_PHOTOS, equipmentTypes, type EquipmentType } from "@/lib/equipment";
import { validatePhoto } from "@/lib/handoff";

/*
 * Formulário "Publicar anúncio" (inventário: tipo, título, descrição, preço/dia,
 * cidade, localização via geolocalização) + decisões de 09/10/2026:
 * bairro, endereço de retirada, 4 a 10 fotos, horário de retirada e de devolução.
 *
 * Os limites de tamanho de texto e de preço são propostas, a confirmar.
 * As mesmas regras valem no navegador e no servidor.
 */

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 1000;
/** Preço por hora: até R$ 999. Diária (teto, opcional): até R$ 9.999 (decisão de 16/11/2026). */
export const PRICE_MAX = 999;
/** Preço por hora mínimo: R$ 30 (decisão de 16/11/2026). */
export const HOURLY_MIN = 30;
export const DAILY_MAX = 9999;

export type ListingField =
  | "type"
  | "title"
  | "description"
  | "hourly_price"
  | "daily_price"
  | "city"
  | "area"
  | "pickup_address"
  | "location"
  | "photos"
  | "pickup_time"
  | "return_time";

export type ListingError =
  | "required"
  | "tooLong"
  | "priceInvalid"
  | "dailyBelowHourly"
  | "hourlyBelowMin"
  | "locationRequired"
  | "locationNotFound"
  | "photosTooFew"
  | "photosTooMany"
  | "photoType"
  | "photoTooLarge"
  | "timeInvalid";

export type ListingErrors = Partial<Record<ListingField, ListingError>>;

/** "45", "45,50" ou "45.50" → 45.5. Devolve null se não for um valor válido. */
export function parsePrice(raw: string, max = PRICE_MAX): number | null {
  const text = raw.trim().replace(/\s/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 && value <= max ? value : null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ListingInput = {
  type: string;
  title: string;
  description: string;
  hourly_price: string;
  /** Opcional: vazio = o preço por hora até o fim do atendimento. */
  daily_price: string;
  city: string;
  area: string;
  pickup_address: string;
  latitude: string;
  longitude: string;
  pickup_time: string;
  return_time: string;
  photos: { size: number; type: string }[];
  /** Na edição, as fotos atuais ficam se nenhuma nova for enviada. */
  keepPhotos?: boolean;
};

export function validateListing(input: ListingInput): ListingErrors {
  const errors: ListingErrors = {};
  const text = (field: ListingField, value: string, max?: number) => {
    const clean = value.trim();
    if (!clean) errors[field] = "required";
    else if (max && clean.length > max) errors[field] = "tooLong";
  };

  if (!equipmentTypes.includes(input.type as EquipmentType)) errors.type = "required";
  text("title", input.title, TITLE_MAX);
  text("description", input.description, DESCRIPTION_MAX);
  // Preço por hora (obrigatório) e diária como teto (opcional).
  const hourly = parsePrice(input.hourly_price);
  if (!input.hourly_price.trim()) errors.hourly_price = "required";
  else if (hourly === null) errors.hourly_price = "priceInvalid";
  else if (hourly < HOURLY_MIN) errors.hourly_price = "hourlyBelowMin";
  if (input.daily_price.trim()) {
    const daily = parsePrice(input.daily_price, DAILY_MAX);
    if (daily === null) errors.daily_price = "priceInvalid";
    else if (hourly !== null && daily < hourly) errors.daily_price = "dailyBelowHourly";
  }
  text("city", input.city);
  text("area", input.area);
  text("pickup_address", input.pickup_address);

  // Marcar no mapa é opcional (decisão de 20/10/2026): sem marcar, o servidor
  // acha a região pelo endereço de retirada. Se marcou, o ponto precisa ser válido.
  if (input.latitude || input.longitude) {
    const lat = Number(input.latitude);
    const lng = Number(input.longitude);
    if (!input.latitude || !input.longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      errors.location = "locationRequired";
    }
  }

  if (!(input.keepPhotos && input.photos.length === 0)) {
    if (input.photos.length < MIN_PHOTOS) errors.photos = "photosTooFew";
    else if (input.photos.length > MAX_PHOTOS) errors.photos = "photosTooMany";
    else {
      const problem = input.photos.map((photo) => validatePhoto(photo)).find(Boolean);
      if (problem === "photoType" || problem === "photoTooLarge") errors.photos = problem;
    }
  }

  if (!input.pickup_time) errors.pickup_time = "required";
  else if (!TIME.test(input.pickup_time)) errors.pickup_time = "timeInvalid";
  if (!input.return_time) errors.return_time = "required";
  else if (!TIME.test(input.return_time)) errors.return_time = "timeInvalid";

  return errors;
}

/** Lê o formulário (no navegador ou no servidor) no formato da validação. */
export function readListingForm(formData: FormData, keepPhotos = false): ListingInput {
  const get = (name: string) => String(formData.get(name) ?? "");
  const photos = formData
    .getAll("photos")
    .filter((item): item is File => typeof item === "object" && item !== null && "size" in item && item.size > 0);
  return {
    type: get("type"),
    title: get("title"),
    description: get("description"),
    hourly_price: get("hourly_price"),
    daily_price: get("daily_price"),
    // Cidade da lista oficial chega como "Nome|UF" (vazio se não escolheu da lista).
    city: get("city").split("|")[0],
    area: get("area"),
    pickup_address: get("pickup_address"),
    latitude: get("latitude"),
    longitude: get("longitude"),
    pickup_time: get("pickup_time"),
    return_time: get("return_time"),
    photos,
    keepPhotos,
  };
}
