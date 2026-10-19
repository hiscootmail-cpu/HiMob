"use server";

import { redirect } from "next/navigation";

import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { validateDocument, type FieldErrorKey } from "@/lib/validation";

/*
 * Envio de documento ou carta para a equipe de verificação.
 * Com a Supabase: o navegador envia os arquivos direto para a pasta privada da
 * pessoa (só a equipe lê) e aqui registramos o pedido. O servidor recusa o
 * envio de quem já foi aprovado ou, no caso do documento, de quem está
 * bloqueado — mesmo tentando pelo endereço direto.
 * Sem a Supabase (demonstração): só valida e simula.
 */

/**
 * Registra o pedido de análise com os arquivos que o navegador já enviou para a
 * pasta privada da pessoa. Devolve false se não for permitido.
 */
async function saveSubmission(kind: "document" | "letter", formData: FormData): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("identity_status").eq("id", user.id).maybeSingle();
  const status = profile?.identity_status;
  if (status === "approved" || (kind === "document" && status === "blocked")) return false;

  const names = kind === "document" ? ["front_path", "back_path"] : ["letter_path"];
  const paths = Object.fromEntries(names.map((name) => [name, String(formData.get(name) ?? "")]));
  // Só arquivos da pasta da própria pessoa.
  if (!Object.values(paths).every((path) => path.startsWith(`${user.id}/`))) return false;

  const { error } = await supabase.from("identity_submissions").insert({ user_id: user.id, kind, ...paths });
  return !error;
}

export type ResubmitState = {
  fieldErrors?: { documentFront?: FieldErrorKey; documentBack?: FieldErrorKey };
  done?: boolean;
  error?: "notAllowed";
};

export async function resubmitDocument(_prev: ResubmitState, formData: FormData): Promise<ResubmitState> {
  if (supabaseConfigured()) return (await saveSubmission("document", formData)) ? { done: true } : { error: "notAllowed" };
  const front = formData.get("documentFront");
  const back = formData.get("documentBack");

  const fieldErrors = {
    documentFront: validateDocument(front instanceof File ? front : null) ?? undefined,
    documentBack: validateDocument(back instanceof File ? back : null) ?? undefined,
  };
  if (fieldErrors.documentFront || fieldErrors.documentBack) return { fieldErrors };

  return { done: true };
}

export type LetterState = {
  fieldErrors?: { letter?: FieldErrorKey };
  done?: boolean;
  error?: "notAllowed";
};

/**
 * Revisão de cadastro bloqueado para pessoa trans com documento ainda não
 * retificado: foto da carta escrita à mão com nome social e CPF.
 */
export async function submitSocialNameLetter(_prev: LetterState, formData: FormData): Promise<LetterState> {
  if (supabaseConfigured()) return (await saveSubmission("letter", formData)) ? { done: true } : { error: "notAllowed" };
  const letter = formData.get("letter");
  const letterError = validateDocument(letter instanceof File ? letter : null);
  if (letterError) return { fieldErrors: { letter: letterError } };

  return { done: true };
}
