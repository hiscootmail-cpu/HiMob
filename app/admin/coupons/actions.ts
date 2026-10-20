"use server";

import { revalidatePath } from "next/cache";

import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Cupons de aluguel, criados e editados só pela equipe (decisão de 20/10/2026).
 * O servidor confere em CADA ação se quem pediu é da equipe, e o banco confere
 * de novo. Sem a Supabase (demonstração), nada é gravado.
 */

export type CouponFormState = {
  done?: boolean;
  error?:
    | "notAllowed"
    | "saveFailed"
    | "code"
    | "codeTaken"
    | "city"
    | "maxUses"
    | "perPerson"
    | "maxDays"
    | "validUntil"
    | "percent";
};

async function isAdmin() {
  return Boolean((await getCurrentUser())?.is_admin);
}

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Número inteiro opcional: vazio = sem limite. */
function optionalInt(value: string, min: number, max: number): number | null | "bad" {
  if (!value) return null;
  if (!/^\d+$/.test(value)) return "bad";
  const n = Number(value);
  return n >= min && n <= max ? n : "bad";
}

function readCoupon(formData: FormData) {
  const code = text(formData, "code").replace(/\s/g, "").toUpperCase();
  const city = text(formData, "city");
  const maxUses = optionalInt(text(formData, "max_uses"), 1, 100000);
  const perPerson = optionalInt(text(formData, "per_person"), 1, 1000);
  const maxDays = optionalInt(text(formData, "max_days"), 1, 60);
  const validUntil = text(formData, "valid_until");
  // Aluguel grátis, ou desconto: x% no aluguel (parte do Host) e y% na taxa (parte da Hi Scoot).
  const kind = text(formData, "kind") === "discount" ? "discount" : "free";
  const rentalPercent = kind === "discount" ? (optionalInt(text(formData, "rental_percent"), 0, 100) ?? 0) : 0;
  const feePercent = kind === "discount" ? (optionalInt(text(formData, "fee_percent"), 0, 100) ?? 0) : 0;
  let error: CouponFormState["error"];
  if (!/^[A-Z0-9]{3,30}$/.test(code)) error = "code";
  else if (city && (city.length < 2 || city.length > 80)) error = "city";
  else if (maxUses === "bad") error = "maxUses";
  else if (perPerson === "bad") error = "perPerson";
  else if (maxDays === "bad") error = "maxDays";
  else if (validUntil && !/^\d{4}-\d{2}-\d{2}$/.test(validUntil)) error = "validUntil";
  else if (rentalPercent === "bad" || feePercent === "bad" || (kind === "discount" && !rentalPercent && !feePercent)) error = "percent";
  return {
    error,
    row: {
      code,
      city: city || null,
      max_uses: maxUses === "bad" ? null : maxUses,
      per_person: perPerson === "bad" ? null : perPerson,
      max_days: maxDays === "bad" ? null : maxDays,
      valid_until: validUntil || null,
      kind,
      rental_percent: rentalPercent === "bad" ? 0 : rentalPercent,
      fee_percent: feePercent === "bad" ? 0 : feePercent,
    },
  };
}

function refresh() {
  revalidatePath("/admin/coupons");
}

/** Criar cupom: aluguel grátis, ou desconto em % no aluguel e na taxa. */
export async function createCoupon(_prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const { error, row } = readCoupon(formData);
  if (error) return { error };
  if (!supabaseConfigured()) return { done: true };
  const supabase = await createClient();
  const { error: dbError } = await supabase.from("coupons").insert(row);
  if (dbError) return { error: dbError.code === "23505" ? "codeTaken" : "saveFailed" };
  refresh();
  return { done: true };
}

/** Editar cupom: código, cidade, limites e validade. */
export async function updateCoupon(id: string, _prev: CouponFormState, formData: FormData): Promise<CouponFormState> {
  if (!(await isAdmin())) return { error: "notAllowed" };
  const { error, row } = readCoupon(formData);
  if (error) return { error };
  if (!supabaseConfigured()) return { done: true };
  const supabase = await createClient();
  const { error: dbError } = await supabase.from("coupons").update(row).eq("id", id);
  if (dbError) return { error: dbError.code === "23505" ? "codeTaken" : "saveFailed" };
  refresh();
  return { done: true };
}

/** Ligar ou desligar (reversível). */
export async function setCouponActive(id: string, active: boolean): Promise<boolean> {
  if (!(await isAdmin())) return false;
  if (!supabaseConfigured()) return true;
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").update({ active }).eq("id", id);
  if (error) return false;
  refresh();
  return true;
}

/** Apagar de vez (irreversível). As reservas feitas guardam o código usado. */
export async function deleteCoupon(id: string): Promise<boolean> {
  if (!(await isAdmin())) return false;
  if (!supabaseConfigured()) return true;
  const supabase = await createClient();
  const { error } = await supabase.from("coupons").delete().eq("id", id);
  if (error) return false;
  refresh();
  return true;
}
