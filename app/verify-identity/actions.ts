"use server";

import { redirect } from "next/navigation";

import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { validateDocument, type FieldErrorKey } from "@/lib/validation";

/*
 * Envio de documento ou carta para a equipe de verificação.
 * Com a Supabase: os arquivos vão para a pasta privada da pessoa (só a equipe
 * lê) e o servidor recusa o envio de quem já foi aprovado ou, no caso do
 * documento, de quem está bloqueado — mesmo tentando pelo endereço direto.
 * Sem a Supabase (demonstração): só valida e simula.
 */

function extension(file: File) {
  return file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
}

/** Grava os arquivos e o pedido de análise. Devolve false se não for permitido. */
async function saveSubmission(kind: "document" | "letter", files: Record<string, File>): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase.from("profiles").select("identity_status").eq("id", user.id).maybeSingle();
  const status = profile?.identity_status;
  if (status === "approved" || (kind === "document" && status === "blocked")) return false;

  const stamp = Date.now();
  const paths: Record<string, string> = {};
  for (const [name, file] of Object.entries(files)) {
    const path = `${user.id}/${name}-${stamp}.${extension(file)}`;
    const { error } = await supabase.storage.from("identity-documents").upload(path, file, { contentType: file.type });
    if (error) return false;
    paths[`${name}_path`] = path;
  }
  const { error } = await supabase.from("identity_submissions").insert({ user_id: user.id, kind, ...paths });
  return !error;
}

export type ResubmitState = {
  fieldErrors?: { documentFront?: FieldErrorKey; documentBack?: FieldErrorKey };
  done?: boolean;
  error?: "notAllowed";
};

export async function resubmitDocument(_prev: ResubmitState, formData: FormData): Promise<ResubmitState> {
  const front = formData.get("documentFront");
  const back = formData.get("documentBack");

  const fieldErrors = {
    documentFront: validateDocument(front instanceof File ? front : null) ?? undefined,
    documentBack: validateDocument(back instanceof File ? back : null) ?? undefined,
  };
  if (fieldErrors.documentFront || fieldErrors.documentBack) return { fieldErrors };

  if (supabaseConfigured() && !(await saveSubmission("document", { front: front as File, back: back as File }))) {
    return { error: "notAllowed" };
  }
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
  const letter = formData.get("letter");
  const letterError = validateDocument(letter instanceof File ? letter : null);
  if (letterError) return { fieldErrors: { letter: letterError } };

  if (supabaseConfigured() && !(await saveSubmission("letter", { letter: letter as File }))) {
    return { error: "notAllowed" };
  }
  return { done: true };
}
