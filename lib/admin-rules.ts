/* Regras do campo Motivo (painel do administrador): valem no navegador e no servidor. */

export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function validateReason(reason: string): "reasonRequired" | "reasonTooShort" | "reasonTooLong" | null {
  const clean = reason.trim();
  if (!clean) return "reasonRequired";
  if (clean.length < REASON_MIN) return "reasonTooShort";
  if (clean.length > REASON_MAX) return "reasonTooLong";
  return null;
}
