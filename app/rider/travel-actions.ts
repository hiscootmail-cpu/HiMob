"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, todayInSaoPaulo } from "@/lib/booking";
import { readCityField } from "@/lib/br-cities-server";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Rider em viagem (decisão de 21/10/2026): cidade da lista oficial e data de
 * volta. Enquanto vale, o Explorar abre nessa cidade. Viagem de até 1 ano.
 */

export type TravelState = {
  errors?: { city?: "cityRequired" | "cityInvalid"; until?: "untilRequired" | "untilPast" | "untilTooFar" };
  error?: "unexpected";
  done?: boolean;
};

const MAX_DAYS = 365;

export async function saveTravel(_prev: TravelState, formData: FormData): Promise<TravelState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const city = readCityField(formData, "travelCity", true);
  const until = String(formData.get("until") ?? "");
  const today = todayInSaoPaulo();
  const untilError = !/^\d{4}-\d{2}-\d{2}$/.test(until)
    ? ("untilRequired" as const)
    : until < today
      ? ("untilPast" as const)
      : until > addDays(today, MAX_DAYS)
        ? ("untilTooFar" as const)
        : undefined;
  if (city.error || untilError) return { errors: { city: city.error, until: untilError } };

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ travel_city: city.city?.city, travel_city_state: city.city?.uf, travel_until: until })
      .eq("id", user.id);
    if (error) return { error: "unexpected" };
  }
  revalidatePath("/", "layout");
  return { done: true };
}

export async function endTravel(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.from("profiles").update({ travel_city: null, travel_city_state: null, travel_until: null }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
}
