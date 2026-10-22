"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { addDays, todayInSaoPaulo } from "@/lib/booking";
import { readCityField } from "@/lib/br-cities-server";
import { equipmentTypes, type EquipmentType } from "@/lib/equipment";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Viagens do Rider (decisões de 21 e 22/10/2026): várias, sem cruzar datas.
 * Cidade da lista oficial, ida, volta e o que pretende usar. Dá para avisar
 * antes; da ida até a volta, o Explorar abre na cidade da viagem. Ida até 1 ano
 * à frente; viagem de até 1 ano.
 */

export type TravelState = {
  errors?: {
    city?: "cityRequired" | "cityInvalid";
    from?: "fromRequired" | "fromPast" | "fromTooFar";
    until?: "untilRequired" | "untilPast" | "untilBeforeFrom" | "untilTooFar";
    wants?: "wantsRequired";
  };
  error?: "unexpected" | "overlap" | "tooMany";
  done?: boolean;
};

const MAX_DAYS = 365;


/** Nova viagem (campo tripId vazio) ou mudança de uma viagem da pessoa. */
export async function saveTrip(_prev: TravelState, formData: FormData): Promise<TravelState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const tripId = String(formData.get("tripId") ?? "") || null;
  const city = readCityField(formData, "travelCity", true);
  const from = String(formData.get("from") ?? "");
  const until = String(formData.get("until") ?? "");
  // Um ou mais tipos (decisão de 22/10/2026).
  const wants = [...new Set(formData.getAll("wants").map(String))].filter((w): w is EquipmentType =>
    equipmentTypes.includes(w as EquipmentType),
  );
  const today = todayInSaoPaulo();
  const isDay = (day: string) => /^\d{4}-\d{2}-\d{2}$/.test(day);
  const fromError = !isDay(from)
    ? ("fromRequired" as const)
    : from < today && !tripId
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
  const wantsError = wants.length ? undefined : ("wantsRequired" as const);
  if (city.error || fromError || untilError || wantsError) {
    return { errors: { city: city.error, from: fromError, until: untilError, wants: wantsError } };
  }

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const row = { city: city.city?.city, city_state: city.city?.uf, from_day: from, until_day: until, wants };
    const { error } = tripId
      ? await supabase.from("rider_trips").update(row).eq("id", tripId).eq("rider_id", user.id)
      : await supabase.from("rider_trips").insert({ ...row, rider_id: user.id });
    if (error) {
      if (error.code === "23P01") return { error: "overlap" };
      if (error.message === "too_many_trips") return { error: "tooMany" };
      return { error: "unexpected" };
    }
  }
  revalidatePath("/", "layout");
  return { done: true };
}

export async function deleteTrip(tripId: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.from("rider_trips").delete().eq("id", tripId).eq("rider_id", user.id);
  }
  revalidatePath("/", "layout");
}
