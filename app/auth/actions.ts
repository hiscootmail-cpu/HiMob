"use server";

import { redirect } from "next/navigation";

import {
  validateEmail,
  validateNewPassword,
  validatePasswordPresent,
  type FieldErrorKey,
} from "@/lib/validation";

/*
 * PROVISÓRIO: estas ações ainda NÃO criam conta nem conferem senha de verdade.
 * Elas só validam o preenchimento e simulam a resposta, para as telas poderem
 * ser testadas. A ligação com o Supabase substitui o miolo de cada função.
 */

/** Conta de teste para simular um login certo. Sai quando o Supabase entrar. */
const DEMO_EMAIL = "teste@hiscoot.com.br";
const DEMO_PASSWORD = "hiscoot123";

export type AuthFormState = {
  /** Erro geral do formulário (chave em "auth.errors"). */
  error?: "invalidCredentials";
  fieldErrors?: { email?: FieldErrorKey; password?: FieldErrorKey };
  /** Valores devolvidos para o campo não ficar vazio depois de um erro. */
  values?: { email?: string };
  /** Pedido concluído (usado em "Esqueci a senha"). */
  done?: boolean;
};

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

  // Mensagem neutra: não diz se o erro foi no e-mail ou na senha.
  if (email.toLowerCase() !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return { error: "invalidCredentials", values: { email } };
  }

  redirect("/");
}

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = text(formData, "email").trim();
  const password = text(formData, "password");

  const fieldErrors = {
    email: validateEmail(email) ?? undefined,
    password: validateNewPassword(password) ?? undefined,
  };
  if (fieldErrors.email || fieldErrors.password) {
    return { fieldErrors, values: { email } };
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

  redirect("/");
}
