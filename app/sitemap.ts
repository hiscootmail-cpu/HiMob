import type { MetadataRoute } from "next";

import { listEquipment } from "@/lib/equipment-db";
import { listWorldProducts } from "@/lib/scoot-world";
import { supabaseConfigured } from "@/lib/supabase/config";
import { SITE_URL } from "@/lib/site-url";

/** Páginas públicas: início, Mundo Scoot, Termos, Privacidade, anúncios e produtos publicados (só os de verdade). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/scoot-world`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/scoot-world/store`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/scoot-world/hitv`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/scoot-world/places`, changeFrequency: "weekly", priority: 0.6 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  if (!supabaseConfigured()) return pages;
  const [listings, products] = await Promise.all([listEquipment(), listWorldProducts()]);
  return [
    ...pages,
    ...listings.map((e) => ({ url: `${SITE_URL}/equipment/${e.id}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...products.filter((p) => p.active).map((p) => ({ url: `${SITE_URL}/scoot-world/store/${p.id}`, changeFrequency: "weekly" as const, priority: 0.5 })),
  ];
}
