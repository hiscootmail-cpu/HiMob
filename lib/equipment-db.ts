import "server-only";

import { FALLBACK_LOCATION, type Equipment, type EquipmentType } from "@/lib/equipment";
import { exampleEquipment } from "@/lib/mock/equipment";
import { supabaseConfigured } from "@/lib/supabase/config";
import { equipmentPhotoUrl } from "@/lib/supabase/photos";
import { createClient } from "@/lib/supabase/server";

/** Linha devolvida pela função "listings" do banco (só anúncios aprovados). */
type ListingRow = {
  id: string;
  host_id: string;
  type: EquipmentType;
  title: string;
  description: string;
  daily_price: number;
  city: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  pickup_time: string;
  return_time: string;
  is_available: boolean;
  photos: string[];
  rating_avg: number | null;
  rating_count: number;
  host_name: string;
  host_verified: boolean;
  host_since: number | null;
  host_rating_avg: number | null;
  host_rating_count: number;
};

const hhmm = (time: string) => time.slice(0, 5);

function fromRow(row: ListingRow): Equipment {
  return {
    id: row.id,
    host_id: row.host_id,
    type: row.type,
    title: row.title,
    description: row.description,
    daily_price: Number(row.daily_price),
    city: row.city,
    area: row.area,
    photos: row.photos.map(equipmentPhotoUrl),
    latitude: row.latitude ?? FALLBACK_LOCATION.latitude,
    longitude: row.longitude ?? FALLBACK_LOCATION.longitude,
    is_available: row.is_available,
    pickup_time: hhmm(row.pickup_time),
    return_time: hhmm(row.return_time),
    rating: row.rating_count ? { average: Number(row.rating_avg), count: row.rating_count } : null,
    host: {
      id: row.host_id,
      full_name: row.host_name,
      verified: row.host_verified,
      host_since: row.host_since ?? new Date().getFullYear(),
      rating: row.host_rating_count ? { average: Number(row.host_rating_avg), count: row.host_rating_count } : null,
    },
  };
}

/*
 * Com a Supabase: busca no banco só os anúncios aprovados (função "listings").
 * Sem a Supabase (demonstração): devolve os exemplos.
 */
export async function listEquipment(): Promise<Equipment[]> {
  if (!supabaseConfigured()) return exampleEquipment;
  const supabase = await createClient();
  const { data } = await supabase.rpc("listings");
  return ((data ?? []) as ListingRow[]).map(fromRow);
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  if (!supabaseConfigured()) return exampleEquipment.find((item) => item.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("listings", { p_id: id });
  const row = (data as ListingRow[] | null)?.[0];
  return row ? fromRow(row) : null;
}
