"use server";

import { validateDocument, type FieldErrorKey } from "@/lib/validation";

/*
 * PROVISÓRIO: ainda não guarda os arquivos nem confere a situação real da conta.
 * Quando o Supabase entrar, o servidor também vai recusar o reenvio de quem
 * já está bloqueado ou aprovado, mesmo que a pessoa tente pelo endereço direto.
 */

export type ResubmitState = {
  fieldErrors?: { documentFront?: FieldErrorKey; documentBack?: FieldErrorKey };
  done?: boolean;
};

export async function resubmitDocument(_prev: ResubmitState, formData: FormData): Promise<ResubmitState> {
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
};

/**
 * Revisão de cadastro bloqueado para pessoa trans com documento ainda não
 * retificado: foto da carta escrita à mão com nome social e CPF.
 * PROVISÓRIO: ainda não guarda o arquivo (ver aviso no início deste arquivo).
 */
export async function submitSocialNameLetter(_prev: LetterState, formData: FormData): Promise<LetterState> {
  const letter = formData.get("letter");
  const letterError = validateDocument(letter instanceof File ? letter : null);
  if (letterError) return { fieldErrors: { letter: letterError } };

  return { done: true };
}
