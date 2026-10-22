import "server-only";

import { addDays } from "@/lib/booking";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Viagens do Rider (decisão de 22/10/2026): várias, sem cruzar datas. Cada uma
 * com cidade (lista oficial), ida, volta e o que pretende usar. Da ida até a
 * volta, o Explorar abre na cidade da viagem.
 */

export type TripWants = "scooter" | "ebike" | "both";

export type Trip = { id: string; city: string; uf: string; from: string; until: string; wants: TripWants };

/** Até 10 viagens por vir (o banco também confere). */
export const MAX_TRIPS = 10;

/** Exemplo da demonstração (sem Supabase). */
function exampleTrips(today: string): Trip[] {
  return [
    { id: "viagem-exemplo-1", city: "Ubatuba", uf: "SP", from: addDays(today, 3), until: addDays(today, 6), wants: "scooter" },
    { id: "viagem-exemplo-2", city: "Rio de Janeiro", uf: "RJ", from: addDays(today, 30), until: addDays(today, 34), wants: "both" },
  ];
}

/** Viagens da pessoa conectada que ainda não acabaram, da mais próxima para a mais longe. */
export async function listMyTrips(today: string): Promise<Trip[]> {
  if (!supabaseConfigured()) return (await getCurrentUser()) ? exampleTrips(today) : [];
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("rider_trips")
    .select("id, city, city_state, from_day, until_day, wants")
    .eq("rider_id", user.id)
    .gte("until_day", today)
    .order("from_day");
  return (data ?? []).map((row) => ({
    id: row.id as string,
    city: row.city as string,
    uf: row.city_state as string,
    from: row.from_day as string,
    until: row.until_day as string,
    wants: row.wants as TripWants,
  }));
}

/** Viagem valendo hoje (da ida até a volta, inclusive). */
export const currentTrip = (trips: Trip[], today: string) => trips.find((trip) => trip.from <= today && today <= trip.until) ?? null;
