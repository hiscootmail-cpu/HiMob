import type { MetadataRoute } from "next";

import { listEquipment } from "@/lib/equipment-db";
import { supabaseConfigured } from "@/lib/supabase/config";
import { SITE_URL } from "@/lib/site-url";

/** Páginas públicas: início, Termos, Privacidade e os anúncios publicados (só os de verdade). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
  if (!supabaseConfigured()) return pages;
  const listings = await listEquipment();
  return [...pages, ...listings.map((e) => ({ url: `${SITE_URL}/equipment/${e.id}`, changeFrequency: "weekly" as const, priority: 0.8 }))];
}
