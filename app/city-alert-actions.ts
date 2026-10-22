"use server";

import { redirect } from "next/navigation";

import { readCityField } from "@/lib/br-cities-server";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Cidade sem oferta (decisão de 22/10/2026): "Avisar quando tiver nesta cidade".
 * O banco também avisa todas as pessoas cadastradas da demanda por Hosts ali.
 */

export type CityAlertState = { error?: "cityRequired" | "cityInvalid" | "unexpected"; done?: string };

export async function requestCityAlert(_prev: CityAlertState, formData: FormData): Promise<CityAlertState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/sign-up");
  const { city, error } = readCityField(formData, "alertCity", true);
  if (error || !city) return { error: error ?? "cityRequired" };
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error: dbError } = await supabase.rpc("request_city_alert", { p_city: city.city, p_uf: city.uf });
    if (dbError) return { error: "unexpected" };
  }
  return { done: `${city.city} - ${city.uf}` };
}
