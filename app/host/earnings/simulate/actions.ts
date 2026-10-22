"use server";

import { checkCity } from "@/lib/br-cities-server";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/** Procura numa cidade para o simulador: viagens marcadas (90 dias), equipamentos e diária média. */
export type CityDemand = { trips: number; equipment: number; avgDaily: number | null };

export async function cityDemand(cityValue: string): Promise<CityDemand | null> {
  if (!(await getCurrentUser())) return null;
  const city = checkCity(cityValue);
  if (!city) return null;
  if (!supabaseConfigured()) return { trips: 12, equipment: 1, avgDaily: 38 };
  const supabase = await createClient();
  const { data } = await supabase.rpc("city_demand_summary", { p_city: city.city });
  const row = (Array.isArray(data) ? data[0] : data) as { trips_90?: number; equipment?: number; avg_daily?: number | null } | null;
  if (!row) return null;
  return { trips: Number(row.trips_90 ?? 0), equipment: Number(row.equipment ?? 0), avgDaily: row.avg_daily == null ? null : Number(row.avg_daily) };
}
