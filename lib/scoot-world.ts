import "server-only";

import { exampleShippingRates, exampleWorldPlaces, exampleWorldProducts, exampleWorldVideos } from "@/lib/mock/scoot-world";
import type { ShippingRate, StoreOrder, WorldPlace, WorldProduct, WorldVideo } from "@/lib/scoot-world-rules";
import { SUPABASE_URL, supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export * from "@/lib/scoot-world-rules";

/*
 * Leitura do Mundo Scoot. Visitantes veem só o que está ativo; a equipe vê
 * tudo (o banco decide, pelas regras de segurança). Sem a Supabase
 * (demonstração), usa os dados de exemplo.
 */

export function worldPhotoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/world-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

type ProductRow = Omit<WorldProduct, "photo" | "price" | "sizes"> & { price: number | string; sizes?: string[] | null };

const toProduct = (row: ProductRow): WorldProduct => ({
  ...row,
  price: Number(row.price),
  photo: row.photo_path ? worldPhotoUrl(row.photo_path) : undefined,
  sizes: row.sizes ?? [],
});

export async function listWorldProducts(): Promise<WorldProduct[]> {
  if (!supabaseConfigured()) return exampleWorldProducts;
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_products")
    .select("id, name, description, price, photo_path, active, stock, sizes")
    .order("created_at", { ascending: false });
  return (data ?? []).map(toProduct);
}

export async function getWorldProduct(id: string): Promise<WorldProduct | null> {
  if (!supabaseConfigured()) return exampleWorldProducts.find((p) => p.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_products")
    .select("id, name, description, price, photo_path, active, stock, sizes")
    .eq("id", id)
    .maybeSingle();
  return data ? toProduct(data) : null;
}

export async function listWorldVideos(): Promise<WorldVideo[]> {
  if (!supabaseConfigured()) return exampleWorldVideos;
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_videos")
    .select("id, title, youtube_id, active")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listWorldPlaces(): Promise<WorldPlace[]> {
  if (!supabaseConfigured()) return exampleWorldPlaces;
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_places")
    .select("id, kind, name, address, city, phone, services, latitude, longitude, active")
    .order("city")
    .order("name");
  return data ?? [];
}

/** Frete por região (a mesma tabela que o painel da equipe mostra). */
export async function listShippingRates(): Promise<ShippingRate[]> {
  if (!supabaseConfigured()) return exampleShippingRates;
  const supabase = await createClient();
  const { data } = await supabase.from("world_shipping_rates").select("id, state, city, price").order("state").order("city", { nullsFirst: true });
  return (data ?? []).map((r) => ({ ...r, price: Number(r.price) }));
}

export const ORDER_COLUMNS =
  "id, code, status, status_reason, buyer_name, buyer_email, buyer_phone, buyer_cpf, cep, street, number, complement, district, city, state, subtotal, shipping, total, tracking_code, pix_code, pix_qr_base64, expires_at, created_at, world_order_items(name, price, quantity, size)";

type OrderRow = Omit<StoreOrder, "items" | "subtotal" | "shipping" | "total"> & {
  subtotal: number | string;
  shipping: number | string;
  total: number | string;
  world_order_items: { name: string; price: number | string; quantity: number; size: string | null }[] | null;
};

export function toOrder({ world_order_items, ...row }: OrderRow): StoreOrder {
  return {
    ...row,
    subtotal: Number(row.subtotal),
    shipping: Number(row.shipping),
    total: Number(row.total),
    items: (world_order_items ?? []).map((i) => ({ ...i, price: Number(i.price) })),
  };
}

/** Pedidos para a equipe (o banco só entrega para quem é da equipe), mais novos primeiro. */
export async function listStoreOrders(): Promise<StoreOrder[]> {
  if (!supabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("world_orders").select(ORDER_COLUMNS).order("created_at", { ascending: false }).limit(200);
  return ((data ?? []) as unknown as OrderRow[]).map(toOrder);
}
