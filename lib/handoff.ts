/*
 * Retirada e devolução confirmadas por QR code + foto (regra 8, decisão de 08/10/2026).
 *
 * O Rider lê o QR code (ou digita o código escrito embaixo dele) e envia uma
 * foto do equipamento. O servidor confere se o código é o do equipamento desta reserva.
 *
 * Decisão de 09/10/2026: o QR fica numa ETIQUETA COLADA NO EQUIPAMENTO, com o
 * código escrito embaixo. O mesmo QR serve para a retirada e para a devolução.
 * O Host baixa e imprime a etiqueta na área dele (Lote 5).
 * Como a etiqueta é fixa, a foto do equipamento e a confirmação do Host na
 * área dele (inventário: "Confirmar retirada/devolução com foto") completam a prova.
 */

export type HandoffKind = "pickup" | "return";

export const PHOTO_MAX_MB = 10;
export const PHOTO_MAX_BYTES = PHOTO_MAX_MB * 1024 * 1024;
export const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;
export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/heic";

export type HandoffError =
  | "codeRequired"
  | "codeInvalid"
  | "photoRequired"
  | "photoType"
  | "photoTooLarge"
  | "wrongStatus"
  | "uploadFailed";

export function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * PROVISÓRIO: códigos de exemplo das etiquetas. O código real é gerado pelo
 * servidor quando o anúncio é publicado e só fica no servidor e na etiqueta.
 */
const exampleEquipmentCodes: Record<string, string> = {
  "eq-aro10-jardins": "HS-4821",
  "eq-bike-vila-nova": "HS-7305",
  "eq-pro-pinheiros": "HS-1946",
  "eq-dobravel-paulista": "HS-6630",
  "eq-leve-vila-madalena": "HS-2517",
};

export function exampleEquipmentCode(equipmentId: string) {
  return exampleEquipmentCodes[equipmentId] ?? null;
}

export function validatePhoto(file: { size: number; type: string } | null | undefined): HandoffError | null {
  if (!file || file.size === 0) return "photoRequired";
  if (!(PHOTO_TYPES as readonly string[]).includes(file.type)) return "photoType";
  if (file.size > PHOTO_MAX_BYTES) return "photoTooLarge";
  return null;
}

/** Fotos de retirada e devolução vão direto do navegador para a pasta privada da pessoa. */
export const HANDOFF_BUCKET = "handoff-photos";
