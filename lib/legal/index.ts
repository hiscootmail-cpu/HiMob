import { privacy } from "@/lib/legal/privacy";
import { terms } from "@/lib/legal/terms";
import type { LegalDocument } from "@/lib/legal/types";

export type LegalDoc = "terms" | "privacy";

/** Os textos ainda são rascunho: o aviso some quando o jurídico aprovar. */
export const LEGAL_IS_DRAFT = true;

export function legalDocument(doc: LegalDoc, locale: string): LegalDocument {
  const texts = doc === "terms" ? terms : privacy;
  return locale === "en" ? texts.en : texts.pt;
}
