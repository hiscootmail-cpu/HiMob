"use server";

import { listIdentityQueue, listListingQueue, validateReason } from "@/lib/admin";
import { MAX_DOCUMENT_REJECTIONS } from "@/lib/identity";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Decisões da equipe. O servidor confere em CADA ação se quem pediu é da
 * equipe: esconder o painel não protege nada.
 * Com a Supabase, o próprio banco confere de novo (funções review_*), grava a
 * decisão com quem decidiu e quando, e manda o aviso para a pessoa.
 * Sem a Supabase (demonstração), nada é gravado.
 */

const dbError = (message: string): DecisionState["error"] =>
  message === "reason_required" ? "reasonTooShort" : message === "reason_too_long" ? "reasonTooLong" : "notAllowed";

export type DecisionState = {
  done?: "approved" | "rejected" | "blocked";
  error?: "notAllowed" | "reasonRequired" | "reasonTooShort" | "reasonTooLong";
};

async function isAdmin() {
  return Boolean((await getCurrentUser())?.is_admin);
}

export async function decideListing(id: string, decision: "approve" | "reject", _prev: DecisionState, formData: FormData): Promise<DecisionState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  if (supabaseConfigured()) {
    const reason = String(formData.get("reason") ?? "");
    const problem = decision === "reject" ? validateReason(reason) : null;
    if (problem) return { error: problem };
    // id do anúncio (novo) ou "edit:<id da edição>" (edição).
    const supabase = await createClient();
    const approve = decision === "approve";
    const { error } = id.startsWith("edit:")
      ? await supabase.rpc("review_listing_edit", { p_edit: id.slice(5), p_approve: approve, p_reason: approve ? null : reason })
      : await supabase.rpc("review_listing", { p_id: id, p_approve: approve, p_reason: approve ? null : reason });
    return error ? { error: dbError(error.message) } : { done: approve ? "approved" : "rejected" };
  }
  const item = (await listListingQueue()).find((l) => l.id === id);
  if (!item) return { error: "notAllowed" };
  if (decision === "approve") return { done: "approved" };

  const error = validateReason(String(formData.get("reason") ?? ""));
  if (error) return { error };
  return { done: "rejected" };
}

export async function decideIdentity(id: string, decision: "approve" | "reject", _prev: DecisionState, formData: FormData): Promise<DecisionState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  if (supabaseConfigured()) {
    const reason = String(formData.get("reason") ?? "");
    const problem = decision === "reject" ? validateReason(reason) : null;
    if (problem) return { error: problem };
    const supabase = await createClient();
    const approve = decision === "approve";
    const { data, error } = await supabase.rpc("review_identity", { p_submission: id, p_approve: approve, p_reason: approve ? null : reason });
    if (error) return { error: dbError(error.message) };
    return { done: approve ? "approved" : data === "blocked" ? "blocked" : "rejected" };
  }
  const item = (await listIdentityQueue()).find((i) => i.id === id);
  if (!item) return { error: "notAllowed" };
  if (decision === "approve") return { done: "approved" };

  const error = validateReason(String(formData.get("reason") ?? ""));
  if (error) return { error };
  // Carta recusada não conta como nova recusa de documento.
  if (item.kind === "document" && item.rejections + 1 >= MAX_DOCUMENT_REJECTIONS) return { done: "blocked" };
  return { done: "rejected" };
}
