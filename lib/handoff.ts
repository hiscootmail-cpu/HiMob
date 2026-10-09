/*
 * Retirada e devolução confirmadas por QR code + foto (regra 8, decisão de 08/10/2026).
 *
 * O Rider lê o QR code (ou digita o código escrito embaixo dele) e envia uma
 * foto do equipamento. O servidor confere se o código é o desta reserva.
 *
 * EM ABERTO: onde fica o QR (no celular do Host, gerado para cada reserva, ou
 * numa etiqueta no equipamento). A leitura pelo Rider funciona igual nos dois casos.
 */

export type HandoffKind = "pickup" | "return";

export const PHOTO_MAX_MB = 10;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic";

export type HandoffError = "codeRequired" | "codeInvalid" | "photoRequired" | "photoType" | "photoTooLarge" | "wrongStatus";

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/** PROVISÓRIO: código de exemplo. O servidor real gera um código secreto por reserva. */
export function exampleHandoffCode(bookingId: string, kind: HandoffKind) {
  return `${bookingId.toUpperCase()}-${kind === "pickup" ? "R" : "D"}`;
}

export function validatePhoto(file: { size: number; type: string } | null | undefined): HandoffError | null {
  if (!file || file.size === 0) return "photoRequired";
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "photoType";
  if (file.size > PHOTO_MAX_BYTES) return "photoTooLarge";
  return null;
}
