"use server";

import { listIdentityQueue, listListingQueue, validateReason } from "@/lib/admin";
import { MAX_DOCUMENT_REJECTIONS } from "@/lib/identity";
import { getCurrentUser } from "@/lib/session";

/*
 * Decisões da equipe. O servidor confere em CADA ação se quem pediu é da
 * equipe: esconder o painel não protege nada.
 * PROVISÓRIO: nada é gravado; com o Supabase, a decisão vira um aviso para a
 * pessoa (lista de notificações aprovada) e fica registrada com quem decidiu e quando.
 */

export type DecisionState = {
  done?: "approved" | "rejected" | "blocked";
  error?: "notAllowed" | "reasonRequired" | "reasonTooShort" | "reasonTooLong";
};

async function isAdmin() {
  return Boolean((await getCurrentUser())?.is_admin);
}

export async function decideListing(id: string, decision: "approve" | "reject", _prev: DecisionState, formData: FormData): Promise<DecisionState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const item = (await listListingQueue()).find((l) => l.id === id);
  if (!item) return { error: "notAllowed" };
  if (decision === "approve") return { done: "approved" };

  const error = validateReason(String(formData.get("reason") ?? ""));
  if (error) return { error };
  return { done: "rejected" };
}

export async function decideIdentity(id: string, decision: "approve" | "reject", _prev: DecisionState, formData: FormData): Promise<DecisionState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const item = (await listIdentityQueue()).find((i) => i.id === id);
  if (!item) return { error: "notAllowed" };
  if (decision === "approve") return { done: "approved" };

  const error = validateReason(String(formData.get("reason") ?? ""));
  if (error) return { error };
  // Carta recusada não conta como nova recusa de documento.
  if (item.kind === "document" && item.rejections + 1 >= MAX_DOCUMENT_REJECTIONS) return { done: "blocked" };
  return { done: "rejected" };
}
