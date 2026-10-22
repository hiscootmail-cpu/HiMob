"use server";

import { revalidatePath } from "next/cache";

import { listAvailableDays, setAvailableDays, setWeeklyDays } from "@/lib/availability";
import { todayInSaoPaulo } from "@/lib/booking";
import { getHostListing } from "@/lib/host";
import { supabaseConfigured } from "@/lib/supabase/config";

/** available: lista certa vinda do banco (null na demonstração, que não grava nada). */
export type AvailabilityResult = { ok: boolean; available: string[] | null; kept: string[] };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Liberar e tirar dias de um equipamento do Host (decisão de 20/10/2026).
 * Só o dono (o banco confere de novo); dia com reserva aceita não sai.
 */
export async function saveAvailability(listingId: string, add: string[], remove: string[]): Promise<AvailabilityResult> {
  const today = todayInSaoPaulo();
  const listing = await getHostListing(listingId);
  if (!listing) return { ok: false, available: [], kept: [] };
  const clean = (days: string[]) => [...new Set(days)].filter((d) => DATE.test(d) && d >= today).slice(0, 400);
  const added = clean(add).length ? await setAvailableDays(listingId, clean(add), true) : { ok: true, kept: [] };
  const removed = clean(remove).length ? await setAvailableDays(listingId, clean(remove), false) : { ok: true, kept: [] };
  if (!supabaseConfigured()) return { ok: true, available: null, kept: [] };
  revalidatePath(`/equipment/${listingId}`);
  return { ok: added.ok && removed.ok, available: await listAvailableDays(listingId, today), kept: removed.kept };
}

/** Dias que se repetem toda semana (decisão de 22/10/2026). Devolve a lista certa de dias liberados. */
export async function saveWeeklyDays(listingId: string, weekdays: number[]): Promise<AvailabilityResult> {
  const today = todayInSaoPaulo();
  const listing = await getHostListing(listingId);
  if (!listing) return { ok: false, available: [], kept: [] };
  const ok = await setWeeklyDays(listingId, weekdays);
  if (!supabaseConfigured()) return { ok, available: null, kept: [] };
  revalidatePath(`/equipment/${listingId}`);
  return { ok, available: await listAvailableDays(listingId, today), kept: [] };
}
