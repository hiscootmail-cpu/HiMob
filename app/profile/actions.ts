"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { ChosenCity } from "@/lib/br-cities";
import { readCityField } from "@/lib/br-cities-server";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { validateFullName, validatePhone } from "@/lib/validation";

/*
 * Editar meu perfil (inventário de ações): nome, telefone, cidade onde mora e
 * cidade secundária (da lista oficial, decisão de 21/10/2026).
 * Decisão de 09/10/2026: depois da identidade verificada, o NOME fica travado
 * (precisa bater com o documento). O servidor ignora qualquer nome enviado
 * nesse caso, mesmo que alguém mexa na página.
 * Com a Supabase, grava no banco (o banco também trava o nome verificado).
 * Sem a Supabase (demonstração), nada é gravado.
 */

export type ProfileErrors = { fullName?: "nameRequired" | "nameTooShort"; phone?: "phoneRequired" | "phoneInvalid"; city?: "cityRequired" | "cityInvalid"; secondCity?: "cityInvalid" };
export type ProfileState = {
  errors?: ProfileErrors;
  values?: { fullName: string; phone: string; city: ChosenCity | null; secondCity: ChosenCity | null };
  error?: "unexpected";
};

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const nameLocked = user.identity === "approved";
  const values = {
    fullName: nameLocked ? user.full_name : String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
  };
  const city = readCityField(formData, "city", true);
  const secondCity = readCityField(formData, "secondCity", false);
  const errors: ProfileErrors = {
    fullName: nameLocked ? undefined : ((validateFullName(values.fullName) as ProfileErrors["fullName"]) ?? undefined),
    phone: validatePhone(values.phone) ?? undefined,
    city: city.error,
    secondCity: secondCity.error === "cityInvalid" ? "cityInvalid" : undefined,
  };
  const all = { ...values, city: city.city, secondCity: secondCity.city };
  if (errors.fullName || errors.phone || errors.city || errors.secondCity) return { errors, values: all };

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const privateChanges = nameLocked ? { phone: values.phone } : { full_name: values.fullName, phone: values.phone };
    const [a, b] = await Promise.all([
      supabase.from("profile_private").update(privateChanges).eq("id", user.id),
      supabase.from("profiles").update(citiesUpdate(city.city, secondCity.city)).eq("id", user.id),
    ]);
    if (a.error || b.error) return { errors: {}, values: all, error: "unexpected" };
  }

  redirect(`/profile/${user.id}?saved=1`);
}

function citiesUpdate(city: ChosenCity | null, secondCity: ChosenCity | null) {
  return {
    city: city?.city ?? "",
    city_state: city?.uf ?? null,
    second_city: secondCity?.city ?? null,
    second_city_state: secondCity?.uf ?? null,
  };
}

export type CitiesState = { errors?: { city?: "cityRequired" | "cityInvalid"; secondCity?: "cityInvalid" }; error?: "unexpected"; done?: boolean };

/** Quem já tinha conta escolhe as cidades na próxima vez que entra (decisão de 21/10/2026). */
export async function saveCities(_prev: CitiesState, formData: FormData): Promise<CitiesState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const city = readCityField(formData, "city", true);
  const secondCity = readCityField(formData, "secondCity", false);
  const errors = { city: city.error, secondCity: secondCity.error === "cityInvalid" ? ("cityInvalid" as const) : undefined };
  if (errors.city || errors.secondCity) return { errors };
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.from("profiles").update(citiesUpdate(city.city, secondCity.city)).eq("id", user.id);
    if (error) return { error: "unexpected" };
  }
  revalidatePath("/", "layout");
  return { done: true };
}
