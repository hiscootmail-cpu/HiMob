"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, todayInSaoPaulo } from "@/lib/booking";
import { readCityField } from "@/lib/br-cities-server";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Rider em viagem (decisões de 21 e 22/10/2026): cidade da lista oficial, data
 * de ida e de volta. Dá para avisar antes; a viagem vale da ida até a volta e,
 * enquanto vale, o Explorar abre nessa cidade. Ida até 1 ano à frente; viagem
 * de até 1 ano.
 */

export type TravelState = {
  errors?: {
    city?: "cityRequired" | "cityInvalid";
    from?: "fromRequired" | "fromPast" | "fromTooFar";
    until?: "untilRequired" | "untilPast" | "untilBeforeFrom" | "untilTooFar";
  };
  error?: "unexpected";
  done?: boolean;
};

const MAX_DAYS = 365;

export async function saveTravel(_prev: TravelState, formData: FormData): Promise<TravelState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const city = readCityField(formData, "travelCity", true);
  const from = String(formData.get("from") ?? "");
  const until = String(formData.get("until") ?? "");
  const today = todayInSaoPaulo();
  const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day);
  const fromError = !isDay(from)
    ? ("fromRequired" as const)
    : from < today
      ? ("fromPast" as const)
      : from > addDays(today, MAX_DAYS)
        ? ("fromTooFar" as const)
        : undefined;
  const untilError = !isDay(until)
    ? ("untilRequired" as const)
    : until < today
      ? ("untilPast" as const)
      : isDay(from) && until < from
        ? ("untilBeforeFrom" as const)
        : isDay(from) && until > addDays(from, MAX_DAYS)
          ? ("untilTooFar" as const)
          : undefined;
  if (city.error || fromError || untilError) return { errors: { city: city.error, from: fromError, until: untilError } };

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ travel_city: city.city?.city, travel_city_state: city.city?.uf, travel_from: from, travel_until: until })
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
    await supabase.from("profiles").update({ travel_city: null, travel_city_state: null, travel_from: null, travel_until: null }).eq("id", user.id);
  }
  revalidatePath("/", "layout");
}
