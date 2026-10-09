import { SUPABASE_URL } from "@/lib/supabase/config";

/** Endereço público de uma foto de anúncio (pasta pública "equipment-photos"). */
export function equipmentPhotoUrl(path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/equipment-photos/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Extensão do arquivo a partir do tipo da imagem. */
export function photoExtension(type: string): string {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/heic" ? "heic" : "jpg";
}
