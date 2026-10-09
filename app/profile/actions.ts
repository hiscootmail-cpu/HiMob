"use server";

import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/session";
import { CITY_MAX, validateFullName, validatePhone } from "@/lib/validation";

/*
 * Editar meu perfil (inventário de ações): nome, telefone e cidade.
 * Decisão de 09/10/2026: depois da identidade verificada, o NOME fica travado
 * (precisa bater com o documento). O servidor ignora qualquer nome enviado
 * nesse caso, mesmo que alguém mexa na página.
 * PROVISÓRIO: nada é gravado ainda.
 */

export type ProfileErrors = { fullName?: "nameRequired" | "nameTooShort"; phone?: "phoneRequired" | "phoneInvalid"; city?: "cityRequired" | "cityTooLong" };
export type ProfileState = { errors?: ProfileErrors; values?: { fullName: string; phone: string; city: string } };

export async function updateProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");

  const nameLocked = user.identity === "approved";
  const values = {
    fullName: nameLocked ? user.full_name : String(formData.get("fullName") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
  };
  const errors: ProfileErrors = {
    fullName: nameLocked ? undefined : ((validateFullName(values.fullName) as ProfileErrors["fullName"]) ?? undefined),
    phone: validatePhone(values.phone) ?? undefined,
    city: !values.city ? "cityRequired" : values.city.length > CITY_MAX ? "cityTooLong" : undefined,
  };
  if (errors.fullName || errors.phone || errors.city) return { errors, values };

  redirect(`/profile/${user.id}?saved=1`);
}
