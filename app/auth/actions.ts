"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { readCityField } from "@/lib/br-cities-server";
import { DEMO_SESSION_COOKIE } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

import {
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePasswordPresent,
  validatePhone,
  type FieldErrorKey,
} from "@/lib/validation";

/*
 * Entrar, cadastrar e senha.
 * - Com a Supabase configurada: login, cadastro e e-mails de verdade.
 * - Sem a Supabase (modo de demonstração): só validam e simulam a resposta.
 * Os dados sempre são conferidos aqui no servidor, mesmo já conferidos na tela.
 */

/** Conta de teste do modo de demonstração (sem Supabase). */
const DEMO_EMAIL = "teste@hiscoot.com.br";
const DEMO_PASSWORD = "hiscoot123";

export type AuthFormState = {
  /** Erro geral do formulário (chave em "auth.errors"). */
  error?: "invalidCredentials" | "emailNotConfirmed" | "unexpected";
  fieldErrors?: {
    fullName?: FieldErrorKey;
    email?: FieldErrorKey;
    phone?: FieldErrorKey;
    city?: FieldErrorKey;
    secondCity?: FieldErrorKey;
    password?: FieldErrorKey;
    terms?: FieldErrorKey;
  };
  /** Valores devolvidos para o campo não ficar vazio depois de um erro. */
  values?: { email?: string };
  /** Pedido concluído (usado em "Esqueci a senha"). */
  done?: boolean;
  /** Cadastro com a conta já ativa (confirmação de e-mail desligada): entra direto. */
  signedIn?: boolean;
};

/** Endereço do site, para os links dos e-mails de confirmação e de senha nova. */
async function siteOrigin() {
  const list = await headers();
  return list.get("origin") ?? `https://${list.get("host")}`;
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  const password = text(formData, "password");

  const fieldErrors = {
    email: validateEmail(email) ?? undefined,
    password: validatePasswordPresent(password) ?? undefined,
  };
  if (fieldErrors.email || fieldErrors.password) {
    return { fieldErrors, values: { email } };
  }

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Mensagem neutra: não diz se o erro foi no e-mail ou na senha.
      const notConfirmed = error.code === "email_not_confirmed";
      return { error: notConfirmed ? "emailNotConfirmed" : "invalidCredentials", values: { email } };
    }
    // Conta excluída não entra mais (mesma mensagem neutra).
    const { data: deleted } = await supabase.rpc("account_deleted");
    if (deleted === true) {
      await supabase.auth.signOut();
      return { error: "invalidCredentials", values: { email } };
    }
    redirect("/dashboard");
  }

  // Mensagem neutra: não diz se o erro foi no e-mail ou na senha.
  if (email.toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return { error: "invalidCredentials", values: { email } };
  }

  // PROVISÓRIO: sessão de demonstração (ver lib/session.ts).
  (await cookies()).set(DEMO_SESSION_COOKIE, "1", { httpOnly: true, sameSite: "lax", path: "/" });
  redirect("/dashboard");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const fullName = text(formData, "fullName").trim();
  const email = text(formData, "email").trim();
  const password = text(formData, "password");
  // O documento não é pedido no cadastro: só na hora de alugar ou anunciar (decisão de 20/10/2026).
  // Telefone obrigatório (decisão de 19/10/2026): só aparece para a outra pessoa depois da reserva aceita.
  const phone = text(formData, "phone").trim();
  const acceptedTerms = formData.get("terms") === "on";
  // Cidade onde mora (obrigatória) e secundária (opcional), da lista oficial (decisão de 21/10/2026).
  const city = readCityField(formData, "city", true);
  const secondCity = readCityField(formData, "secondCity", false);

  const fieldErrors = {
    fullName: validateFullName(fullName) ?? undefined,
    email: validateEmail(email) ?? undefined,
    phone: validatePhone(phone) ?? undefined,
    city: city.error,
    secondCity: secondCity.error,
    password: validateNewPassword(password) ?? undefined,
    terms: acceptedTerms ? undefined : ("termsRequired" as const),
  };
  if (Object.values(fieldErrors).some(Boolean)) {
    return { fieldErrors, values: { email } };
  }

  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          city: city.city?.city,
          city_state: city.city?.uf,
          second_city: secondCity.city?.city,
          second_city_state: secondCity.city?.uf,
        },
        emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard`,
      },
    });
    if (error && error.code !== "user_already_exists") return { error: "unexpected", values: { email } };

    // Confirmação de e-mail desligada: a conta já nasce ativa e a pessoa entra direto.
    if (data.session) return { values: { email }, signedIn: true };

    // Mesma resposta para e-mail novo ou já cadastrado (não revela quem tem conta).
    redirect("/auth/sign-up-success");
  }

  redirect("/auth/sign-up-success");
}

export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = text(formData, "email").trim();

  const emailError = validateEmail(email);
  if (emailError) return { fieldErrors: { email: emailError }, values: { email } };

  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${await siteOrigin()}/auth/confirm?next=/auth/update-password`,
    });
  }

  // Resposta sempre igual, exista ou não uma conta com este e-mail.
  return { done: true, values: { email } };
}

export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = text(formData, "password");

  const passwordError = validateNewPassword(password);
  if (passwordError) return { fieldErrors: { password: passwordError } };

  if (supabaseConfigured()) {
    // A sessão vem do link do e-mail (/auth/confirm). Sem ela, o link expirou.
    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) redirect("/auth/error");
  }

  redirect("/dashboard");
}

/** Sair: desconecta e volta para a tela de entrada (inventário de ações: Logout). */
export async function signOut() {
  if (supabaseConfigured()) await (await createClient()).auth.signOut();
  (await cookies()).delete(DEMO_SESSION_COOKIE);
  redirect("/auth/login");
}
