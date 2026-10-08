/*
 * Regras de preenchimento usadas no navegador (aviso rápido ao sair do campo)
 * e repetidas no servidor (a checagem que vale de verdade).
 * Cada função devolve a chave do texto de erro em messages/*.json
 * (dentro de "auth.errors") ou null quando está tudo certo.
 */

export const PASSWORD_MIN_LENGTH = 8;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrorKey = "emailRequired" | "emailInvalid" | "passwordRequired" | "passwordTooShort";

export function validateEmail(value: string): FieldErrorKey | null {
  const email = value.trim();
  if (!email) return "emailRequired";
  if (!EMAIL_PATTERN.test(email)) return "emailInvalid";
  return null;
}

/** Senha nova (cadastro e troca de senha): exige o tamanho mínimo. */
export function validateNewPassword(value: string): FieldErrorKey | null {
  if (!value) return "passwordRequired";
  if (value.length < PASSWORD_MIN_LENGTH) return "passwordTooShort";
  return null;
}

/** Senha no login: só confere se foi preenchida. */
export function validatePasswordPresent(value: string): FieldErrorKey | null {
  return value ? null : "passwordRequired";
}
