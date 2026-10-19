import "server-only";

import { exampleWorldPlaces, exampleWorldProducts, exampleWorldVideos } from "@/lib/mock/scoot-world";
import type { WorldPlace, WorldProduct, WorldVideo } from "@/lib/scoot-world-rules";
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

type ProductRow = Omit<WorldProduct, "photo" | "price"> & { price: number | string };

const toProduct = (row: ProductRow): WorldProduct => ({
  ...row,
  price: Number(row.price),
  photo: row.photo_path ? worldPhotoUrl(row.photo_path) : undefined,
});

export async function listWorldProducts(): Promise<WorldProduct[]> {
  if (!supabaseConfigured()) return exampleWorldProducts;
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_products")
    .select("id, name, description, price, photo_path, active")
    .order("created_at", { ascending: false });
  return (data ?? []).map(toProduct);
}

export async function getWorldProduct(id: string): Promise<WorldProduct | null> {
  if (!supabaseConfigured()) return exampleWorldProducts.find((p) => p.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("world_products")
    .select("id, name, description, price, photo_path, active")
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
