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
export const PRICE_MAX = 999;

export type ListingField =
  | "type"
  | "title"
  | "description"
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
  | "locationRequired"
  | "photosTooFew"
  | "photosTooMany"
  | "photoType"
  | "photoTooLarge"
  | "timeInvalid";

export type ListingErrors = Partial<Record<ListingField, ListingError>>;

/** "45", "45,50" ou "45.50" → 45.5. Devolve null se não for um valor válido. */
export function parsePrice(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text)) return null;
  const value = Number(text);
  return value > 0 && value <= PRICE_MAX ? value : null;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export type ListingInput = {
  type: string;
  title: string;
  description: string;
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
  if (!input.daily_price.trim()) errors.daily_price = "required";
  else if (parsePrice(input.daily_price) === null) errors.daily_price = "priceInvalid";
  text("city", input.city);
  text("area", input.area);
  text("pickup_address", input.pickup_address);

  const lat = Number(input.latitude);
  const lng = Number(input.longitude);
  if (!input.latitude || !input.longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    errors.location = "locationRequired";
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
    daily_price: get("daily_price"),
    city: get("city"),
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
