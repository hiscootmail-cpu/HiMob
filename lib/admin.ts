import { exampleIdentityQueue, exampleListingQueue } from "@/lib/mock/admin";
import type { EquipmentType } from "@/lib/equipment";

export { REASON_MAX, REASON_MIN, validateReason } from "@/lib/admin-rules";

/*
 * Painel do administrador (inventário de ações):
 * - Anúncios pendentes: Motivo + Rejeitar / Aprovar.
 * - Cadastros pendentes: Ver documento enviado + Motivo + Rejeitar / Aprovar.
 * Decisões de 09/10/2026:
 * - O Motivo é obrigatório para recusar (ele vai para a pessoa e ensina a corrigir).
 * - Edições de anúncio também passam por aqui; o anúncio antigo segue no ar até a decisão.
 * - As filas mostram o pedido mais antigo primeiro.
 *
 * SEGURANÇA: só a equipe entra. O servidor confere em cada tela E em cada
 * ação; esconder o link não protege nada. Documento e carta são dado sensível
 * (LGPD): só a equipe de verificação vê.
 */

export type ListingChange = { field: "daily_price" | "description" | "photos" | "area" | "times"; before: string; after: string };

export type AdminListing = {
  id: string;
  kind: "new" | "edit";
  title: string;
  type: EquipmentType;
  description: string;
  daily_price: number;
  area: string;
  city: string;
  photos_count: number;
  host: { id: string; name: string; verified: boolean };
  /** Data e hora do envio (ISO). */
  sent_at: string;
  /** Só nas edições: o que mudou. */
  changes?: ListingChange[];
};

export type AdminIdentity = {
  id: string;
  user_id: string;
  /** Nome completo do cadastro, para comparar com o documento. */
  full_name: string;
  sent_at: string;
  /** Documento (frente e verso) ou carta com nome social e CPF. */
  kind: "document" | "letter";
  /** Recusas anteriores (na 2ª, o cadastro é bloqueado). */
  rejections: number;
};

const oldestFirst = <T extends { sent_at: string }>(items: T[]) => [...items].sort((a, b) => a.sent_at.localeCompare(b.sent_at));

/* PROVISÓRIO: devolve os exemplos. Com o Supabase, consultas que só a equipe pode fazer. */
export async function listListingQueue(): Promise<AdminListing[]> {
  return oldestFirst(exampleListingQueue);
}

export async function listIdentityQueue(): Promise<AdminIdentity[]> {
  return oldestFirst(exampleIdentityQueue);
}
