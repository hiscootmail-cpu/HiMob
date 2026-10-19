"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { BR_STATES, WORLD_LIMITS, youtubeId } from "@/lib/scoot-world-rules";
import { refundStoreOrder } from "@/lib/store-orders";
import { validatePhone } from "@/lib/validation";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { photoExtension } from "@/lib/supabase/photos";
import { createClient } from "@/lib/supabase/server";

/*
 * Cadastro do Mundo Scoot pela equipe. O servidor confere em CADA ação se
 * quem pediu é da equipe, e o banco confere de novo (regras de segurança).
 * Sem a Supabase (demonstração), nada é gravado.
 */

export type WorldFormState = {
  done?: boolean;
  error?: "notAllowed" | "saveFailed" | "name" | "price" | "description" | "photo" | "title" | "youtube" | "address" | "city" | "phone" | "services" | "kind" | "stock" | "state" | "shippingPrice" | "regionTaken" | "tracking" | "reason" | "refundFailed";
};

export type WorldTable = "world_products" | "world_videos" | "world_places";
const TABLES: WorldTable[] = ["world_products", "world_videos", "world_places"];
type DeletableTable = WorldTable | "world_shipping_rates";
const DELETABLE: DeletableTable[] = [...TABLES, "world_shipping_rates"];

async function isAdmin() {
  return Boolean((await getCurrentUser())?.is_admin);
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();
const within = (value: string, { min, max }: { min: number; max: number }) => value.length >= min && value.length <= max;
/** "189,90" ou "189.90" ou "1.234,50" */
const money = (value: string) => Number(value.includes(",") ? value.replace(/\./g, "").replace(",", ".") : value);
const wholeNumber = (value: string) => (/^\d+$/.test(value) ? Number(value) : NaN);

function refresh() {
  revalidatePath("/scoot-world", "layout");
  revalidatePath("/admin/scoot-world");
}

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PHOTO_MAX = 10 * 1024 * 1024;

export async function addWorldProduct(_prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const name = text(formData, "name");
  const description = text(formData, "description");
  const price = money(text(formData, "price"));
  const stock = wholeNumber(text(formData, "stock"));
  const photo = formData.get("photo");
  const file = photo instanceof File && photo.size > 0 ? photo : null;

  if (!within(name, WORLD_LIMITS.productName)) return { error: "name" };
  if (!Number.isFinite(price) || price <= 0 || price > WORLD_LIMITS.productPrice) return { error: "price" };
  if (!Number.isInteger(stock) || stock < 0 || stock > WORLD_LIMITS.productStock) return { error: "stock" };
  if (description.length > WORLD_LIMITS.productDescription) return { error: "description" };
  if (file && (!PHOTO_TYPES.includes(file.type) || file.size > PHOTO_MAX)) return { error: "photo" };
  if (!supabaseConfigured()) return { done: true };

  const supabase = await createClient();
  let photoPath: string | null = null;
  if (file) {
    photoPath = `products/${randomUUID()}.${photoExtension(file.type)}`;
    const { error } = await supabase.storage.from("world-photos").upload(photoPath, file, { contentType: file.type });
    if (error) return { error: "saveFailed" };
  }
  const { error } = await supabase
    .from("world_products")
    .insert({ name, description, price: Math.round(price * 100) / 100, stock, photo_path: photoPath });
  if (error) {
    if (photoPath) await supabase.storage.from("world-photos").remove([photoPath]);
    return { error: "saveFailed" };
  }
  refresh();
  return { done: true };
}

export async function addWorldVideo(_prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const title = text(formData, "title");
  const id = youtubeId(text(formData, "youtube"));
  if (!within(title, WORLD_LIMITS.videoTitle)) return { error: "title" };
  if (!id) return { error: "youtube" };
  if (!supabaseConfigured()) return { done: true };

  const supabase = await createClient();
  const { error } = await supabase.from("world_videos").insert({ title, youtube_id: id });
  if (error) return { error: error.code === "23505" ? "youtube" : "saveFailed" };
  refresh();
  return { done: true };
}

export async function addWorldPlace(_prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const kind = text(formData, "kind");
  const name = text(formData, "name");
  const address = text(formData, "address");
  const city = text(formData, "city");
  const phoneRaw = text(formData, "phone");
  const services = text(formData, "services");
  const latitude = Number(text(formData, "latitude"));
  const longitude = Number(text(formData, "longitude"));
  const located = text(formData, "latitude") !== "" && Number.isFinite(latitude) && Number.isFinite(longitude);

  if (kind !== "partner" && kind !== "workshop") return { error: "kind" };
  if (!within(name, WORLD_LIMITS.placeName)) return { error: "name" };
  if (!within(address, WORLD_LIMITS.placeAddress)) return { error: "address" };
  if (!within(city, WORLD_LIMITS.placeCity)) return { error: "city" };
  if (phoneRaw && validatePhone(phoneRaw)) return { error: "phone" };
  if (services.length > WORLD_LIMITS.placeServices) return { error: "services" };
  if (!supabaseConfigured()) return { done: true };

  const supabase = await createClient();
  const { error } = await supabase.from("world_places").insert({
    kind,
    name,
    address,
    city,
    phone: phoneRaw ? phoneRaw.replace(/\D/g, "") : null,
    services,
    latitude: located ? latitude : null,
    longitude: located ? longitude : null,
  });
  if (error) return { error: "saveFailed" };
  refresh();
  return { done: true };
}

/** Esconder ou mostrar de novo (reversível). */
export async function setWorldItemActive(table: WorldTable, id: string, active: boolean): Promise<boolean> {
  if (!TABLES.includes(table) || !(await isAdmin())) return false;
  if (!supabaseConfigured()) return true;
  const supabase = await createClient();
  const { error } = await supabase.from(table).update({ active }).eq("id", id);
  if (error) return false;
  refresh();
  return true;
}

/** Apagar de vez (irreversível: a foto do produto também é apagada). */
export async function deleteWorldItem(table: DeletableTable, id: string): Promise<boolean> {
  if (!DELETABLE.includes(table) || !(await isAdmin())) return false;
  if (!supabaseConfigured()) return true;
  const supabase = await createClient();
  if (table === "world_products") {
    const { data } = await supabase.from("world_products").select("photo_path").eq("id", id).maybeSingle();
    if (data?.photo_path) await supabase.storage.from("world-photos").remove([data.photo_path]);
  }
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) return false;
  refresh();
  return true;
}

/** Ajustar o estoque de um produto (chegou mais, ou conferência). */
export async function updateWorldStock(id: string, _prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const stock = wholeNumber(text(formData, "stock"));
  if (!Number.isInteger(stock) || stock < 0 || stock > WORLD_LIMITS.productStock) return { error: "stock" };
  if (!supabaseConfigured()) return { done: true };
  const supabase = await createClient();
  const { error } = await supabase.from("world_products").update({ stock }).eq("id", id);
  if (error) return { error: "saveFailed" };
  refresh();
  return { done: true };
}

/** Frete fixo por região: estado todo, ou uma cidade do estado. */
export async function addShippingRate(_prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const state = text(formData, "state").toUpperCase();
  const city = text(formData, "city");
  const price = money(text(formData, "price"));
  if (!(BR_STATES as readonly string[]).includes(state)) return { error: "state" };
  if (city && !within(city, WORLD_LIMITS.placeCity)) return { error: "city" };
  if (!Number.isFinite(price) || price <= 0 || price > WORLD_LIMITS.shippingPrice) return { error: "shippingPrice" };
  if (!supabaseConfigured()) return { done: true };
  const supabase = await createClient();
  const { error } = await supabase
    .from("world_shipping_rates")
    .insert({ state, city: city || null, price: Math.round(price * 100) / 100 });
  if (error) return { error: error.code === "23505" ? "regionTaken" : "saveFailed" };
  refresh();
  return { done: true };
}

/** Pedido pago foi despachado: guarda o código de rastreio (a pessoa vê na página do pedido). */
export async function shipOrder(id: string, _prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const tracking = text(formData, "tracking");
  if (tracking.length < 3 || tracking.length > 60) return { error: "tracking" };
  if (!supabaseConfigured()) return { done: true };
  const supabase = await createClient();
  const { error } = await supabase.rpc("ship_world_order", { p_order: id, p_tracking: tracking });
  if (error) return { error: error.message === "tracking_invalid" ? "tracking" : "notAllowed" };
  refresh();
  return { done: true };
}

/** Cancelar e devolver o dinheiro (irreversível; só pedido pago e ainda não enviado). */
export async function refundOrder(id: string, _prev: WorldFormState, formData: FormData): Promise<WorldFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const reason = text(formData, "reason");
  if (reason.length < 5 || reason.length > 200) return { error: "reason" };
  if (!supabaseConfigured()) return { done: true };
  const result = await refundStoreOrder(id, reason);
  if (result !== "done") return { error: result };
  refresh();
  return { done: true };
}
