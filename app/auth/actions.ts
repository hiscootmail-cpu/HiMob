"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { DEMO_SESSION_COOKIE } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient, createSecretClient } from "@/lib/supabase/server";

import {
  validateDocument,
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePasswordPresent,
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
    password?: FieldErrorKey;
    documentFront?: FieldErrorKey;
    documentBack?: FieldErrorKey;
    terms?: FieldErrorKey;
  };
  /** Valores devolvidos para o campo não ficar vazio depois de um erro. */
  values?: { email?: string };
  /** Pedido concluído (usado em "Esqueci a senha"). */
  done?: boolean;
};

/** Endereço do site, para os links dos e-mails de confirmação e de senha nova. */
async function siteOrigin() {
  const list = await headers();
  return list.get("origin") ?? `https://${list.get("host")}`;
}

function extension(file: File) {
  return file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
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
  const documentFront = formData.get("documentFront");
  const documentBack = formData.get("documentBack");
  const acceptedTerms = formData.get("terms") === "on";

  const fieldErrors = {
    fullName: validateFullName(fullName) ?? undefined,
    email: validateEmail(email) ?? undefined,
    password: validateNewPassword(password) ?? undefined,
    documentFront: validateDocument(documentFront instanceof File ? documentFront : null) ?? undefined,
    documentBack: validateDocument(documentBack instanceof File ? documentBack : null) ?? undefined,
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
        data: { full_name: fullName },
        emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=/dashboard`,
      },
    });
    if (error && error.code !== "user_already_exists") return { error: "unexpected", values: { email } };

    // Frente e verso vão para a pasta privada que só a equipe de verificação lê,
    // para conferir se o nome do documento é o mesmo do cadastro.
    // Antes de a pessoa confirmar o e-mail ela ainda não tem sessão: nesse caso
    // o servidor guarda com a chave da equipe. Sem essa chave, o documento é
    // pedido de novo no primeiro acesso (Verificação de identidade).
    const userId = data.user?.identities?.length ? data.user.id : null;
    const uploader = data.session ? supabase : createSecretClient();
    if (userId && uploader && documentFront instanceof File && documentBack instanceof File) {
      const stamp = Date.now();
      const front = `${userId}/cadastro-frente-${stamp}.${extension(documentFront)}`;
      const back = `${userId}/cadastro-verso-${stamp}.${extension(documentBack)}`;
      const bucket = uploader.storage.from("identity-documents");
      const [up1, up2] = await Promise.all([
        bucket.upload(front, documentFront, { contentType: documentFront.type }),
        bucket.upload(back, documentBack, { contentType: documentBack.type }),
      ]);
      if (!up1.error && !up2.error) {
        await uploader
          .from("identity_submissions")
          .insert({ user_id: userId, kind: "document", front_path: front, back_path: back });
      }
    }
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
