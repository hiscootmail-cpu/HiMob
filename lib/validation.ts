/*
 * Regras de preenchimento usadas no navegador (aviso rápido ao sair do campo)
 * e repetidas no servidor (a checagem que vale de verdade).
 * Cada função devolve a chave do texto de erro em messages/*.json
 * (dentro de "auth.errors") ou null quando está tudo certo.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MIN_LENGTH = 3;

/** Documento de identidade: foto ou PDF de até 5 MB. */
export const DOCUMENT_MAX_MB = 5;
export const DOCUMENT_MAX_BYTES = DOCUMENT_MAX_MB * 1024 * 1024;
export const DOCUMENT_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const DOCUMENT_ACCEPT = ".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldErrorKey =
  | "nameRequired"
  | "nameTooShort"
  | "emailRequired"
  | "emailInvalid"
  | "passwordRequired"
  | "passwordTooShort"
  | "documentRequired"
  | "documentType"
  | "documentTooLarge"
  | "termsRequired";

export function validateFullName(value: string): FieldErrorKey | null {
  const name = value.trim();
  if (!name) return "nameRequired";
  if (name.length < NAME_MIN_LENGTH) return "nameTooShort";
  return null;
}

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

/** Documento: precisa existir, ser JPG, PNG ou PDF e ter até 5 MB. */
export function validateDocument(file: { size: number; type: string } | null | undefined): FieldErrorKey | null {
  if (!file || file.size === 0) return "documentRequired";
  if (!(DOCUMENT_TYPES as readonly string[]).includes(file.type)) return "documentType";
  if (file.size > DOCUMENT_MAX_BYTES) return "documentTooLarge";
  return null;
}

/** Cidade no perfil: até 60 letras. */
export const CITY_MAX = 60;

/** Telefone brasileiro: DDD + número, 10 ou 11 dígitos. */
export function validatePhone(phone: string): "phoneRequired" | "phoneInvalid" | null {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "phoneRequired";
  return /^\d{10,11}$/.test(digits) ? null : "phoneInvalid";
}
