"use client";

import { useState } from "react";

import type { FieldErrorKey } from "@/lib/validation";

type LocalCheck = { submission: unknown; error: FieldErrorKey | null };

/**
 * Aviso de erro de um campo: aparece quando a pessoa sai do campo e some
 * assim que ela corrige. Depois de enviar, vale o erro devolvido pelo servidor.
 */
export function useFieldValidation(
  validate: (value: string) => FieldErrorKey | null,
  serverError: FieldErrorKey | undefined,
  /** Muda a cada resposta do servidor, para o erro dele voltar a valer. */
  submission: unknown,
) {
  const [local, setLocal] = useState<LocalCheck | null>(null);

  // A checagem local só vale até a próxima resposta do servidor.
  const current = local?.submission === submission ? local : null;
  const error = current ? (current.error ?? undefined) : serverError;

  return {
    error,
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      setLocal({ submission, error: validate(event.currentTarget.value) });
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      if (error) setLocal({ submission, error: validate(event.currentTarget.value) });
    },
  };
}
