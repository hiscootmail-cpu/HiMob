"use server";

import { redirect } from "next/navigation";

import { setAvailableDays, setWeeklyDays } from "@/lib/availability";
import { todayInSaoPaulo } from "@/lib/booking";
import { checkCity } from "@/lib/br-cities-server";
import { editPolicy, getHostListing } from "@/lib/host";
import { locateAddress } from "@/lib/geocode";
import { parsePrice, readListingForm, validateListing, type ListingErrors } from "@/lib/listing";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Anúncios do Host.
 * Com a Supabase: grava no banco (as regras de segurança conferem o dono e o
 * banco gera o código da etiqueta QR). As fotos chegam já enviadas pelo
 * navegador para a pasta do Host; aqui só conferimos e registramos os caminhos.
 * Sem a Supabase (demonstração): só valida e simula.
 */

/** Caminhos das fotos enviadas pelo navegador (só da pasta da própria pessoa). */
function photoPaths(formData: FormData, userId: string): string[] | null {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("photo_paths") ?? "[]"));
    if (!Array.isArray(parsed) || !parsed.every((p) => typeof p === "string" && p.startsWith(`${userId}/`))) return null;
    return parsed as string[];
  } catch {
    return null;
  }
}

/** Para a validação contar as fotos que já foram enviadas pelo navegador. */
const asFiles = (paths: string[]) => paths.map(() => ({ size: 1, type: "image/jpeg" }));

/** Campos do formulário no formato do banco. */
function listingFields(formData: FormData) {
  const get = (name: string) => String(formData.get(name) ?? "").trim();
  return {
    type: get("type"),
    title: get("title"),
    description: get("description"),
    daily_price: parsePrice(get("daily_price")) ?? 0,
    // Só cidade da lista oficial (o nome, sem o estado).
    city: checkCity(get("city"))?.city ?? "",
    area: get("area"),
    pickup_time: get("pickup_time"),
    return_time: get("return_time"),
    pickup_address: get("pickup_address"),
    latitude: get("latitude") ? Number(get("latitude")) : null,
    longitude: get("longitude") ? Number(get("longitude")) : null,
  };
}

/** Dias liberados no anúncio novo (campo escondido do calendário), de hoje em diante. */
function chosenDays(formData: FormData): string[] {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("available_days") ?? "[]"));
    const today = todayInSaoPaulo();
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed)].filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= today).slice(0, 400);
  } catch {
    return [];
  }
}

/** Dias da semana marcados em "Repetir toda semana" (0 = domingo). */
function chosenWeekdays(formData: FormData): number[] {
  try {
    const parsed: unknown = JSON.parse(String(formData.get("available_days_weekly") ?? "[]"));
    return Array.isArray(parsed) ? [...new Set(parsed)].filter((d): d is number => Number.isInteger(d) && d >= 0 && d <= 6) : [];
  } catch {
    return [];
  }
}

/** "Quero ser Host": self-service, um clique (inventário de ações). */
export async function becomeHost() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.rpc("become_host");
  }
  redirect("/host/equipment/new");
}

export type ListingState = {
  errors?: ListingErrors;
  error?: "notAllowed" | "tooSoon" | "inReview" | "editInReview";
};

/** Publicar anúncio: vai para a análise da equipe antes de aparecer na busca. */
export async function createListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  if (!supabaseConfigured()) {
    const errors = validateListing(readListingForm(formData));
    if (Object.keys(errors).length) return { errors };
    redirect("/host/equipment?sent=new");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const paths = photoPaths(formData, user.id);
  if (!paths) return { error: "notAllowed" };
  const errors = validateListing({ ...readListingForm(formData), photos: asFiles(paths) });
  if (Object.keys(errors).length) return { errors };

  const f = listingFields(formData);
  if (!f.city) return { errors: { city: "required" } };
  // Sem marcar no mapa: acha a região pelo endereço de retirada.
  const point =
    f.latitude !== null && f.longitude !== null
      ? { latitude: f.latitude, longitude: f.longitude }
      : await locateAddress({ address: f.pickup_address, area: f.area, city: f.city });
  if (!point) return { errors: { location: "locationNotFound" } };
  const { data: created, error } = await supabase
    .from("equipment")
    .insert({
      host_id: user.id,
      type: f.type,
      title: f.title,
      description: f.description,
      daily_price: f.daily_price,
      city: f.city,
      area: f.area,
      pickup_time: f.pickup_time,
      return_time: f.return_time,
    })
    .select("id")
    .single();
  if (error || !created) return { error: "notAllowed" };

  const [priv, photos] = await Promise.all([
    supabase.from("equipment_private").insert({
      equipment_id: created.id,
      pickup_address: f.pickup_address,
      latitude: point.latitude,
      longitude: point.longitude,
    }),
    supabase.from("equipment_photos").insert(paths.map((path, position) => ({ equipment_id: created.id, path, position }))),
  ]);
  if (priv.error || photos.error) {
    // Desfaz o anúncio incompleto (ainda em análise, o Host pode apagar).
    await supabase.from("equipment").delete().eq("id", created.id);
    return { error: "notAllowed" };
  }
  // Dias marcados no próprio anúncio (decisão de 21/10/2026). Se falhar, dá para marcar depois.
  const days = chosenDays(formData);
  if (days.length) await setAvailableDays(created.id, days, true);
  // Dias que se repetem toda semana (decisão de 22/10/2026).
  const weekly = chosenWeekdays(formData);
  if (weekly.length) await setWeeklyDays(created.id, weekly);
  // Equipamento da própria Hi Scoot: a equipe publica na hora (decisão de 20/10/2026).
  if ((await getCurrentUser())?.is_admin) {
    const { error: reviewError } = await supabase.rpc("review_listing", { p_id: created.id, p_approve: true, p_reason: null });
    if (!reviewError) redirect("/host/equipment?sent=published");
  }
  redirect("/host/equipment?sent=new");
}

/**
 * Editar anúncio: no máximo uma vez a cada 30 dias.
 * A edição volta para a análise; até lá, o anúncio antigo continua no ar.
 */
export async function updateListing(listingId: string, _prev: ListingState, formData: FormData): Promise<ListingState> {
  const listing = await getHostListing(listingId);
  const isAdmin = Boolean((await getCurrentUser())?.is_admin);
  if (!listing || !editPolicy(listing, todayInSaoPaulo(), isAdmin).allowed) return { error: "notAllowed" };

  if (!supabaseConfigured()) {
    const errors = validateListing(readListingForm(formData, true));
    if (Object.keys(errors).length) return { errors };
    redirect(`/host/equipment?sent=${listing.review_status === "rejected" ? "resent" : "edit"}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  const paths = photoPaths(formData, user.id);
  if (!paths) return { error: "notAllowed" };
  const errors = validateListing({ ...readListingForm(formData, true), photos: asFiles(paths) });
  if (Object.keys(errors).length) return { errors };

  // Só o que mudou vai para a análise.
  const fields = listingFields(formData);
  if (!fields.city) return { errors: { city: "required" } };
  // Sem marcar no mapa: mantém o ponto atual, ou acha a região pelo endereço se ele mudou.
  const addressChanged =
    fields.pickup_address !== listing.pickup_address || fields.area !== listing.area || fields.city !== listing.city;
  let point = fields.latitude !== null && fields.longitude !== null ? { latitude: fields.latitude, longitude: fields.longitude } : null;
  if (!point && !addressChanged) point = { latitude: listing.latitude, longitude: listing.longitude };
  if (!point) point = await locateAddress({ address: fields.pickup_address, area: fields.area, city: fields.city });
  if (!point) return { errors: { location: "locationNotFound" } };
  const f = { ...fields, ...point };
  const current: Record<string, unknown> = {
    type: listing.type,
    title: listing.title,
    description: listing.description,
    daily_price: listing.daily_price,
    city: listing.city,
    area: listing.area,
    pickup_time: listing.pickup_time,
    return_time: listing.return_time,
    pickup_address: listing.pickup_address,
    latitude: listing.latitude,
    longitude: listing.longitude,
  };
  const changes: Record<string, unknown> = Object.fromEntries(
    Object.entries(f).filter(([key, value]) => value !== current[key]),
  );
  if (paths.length) changes.photos = paths;
  if (!Object.keys(changes).length) redirect("/host/equipment");

  const { data, error } = await supabase.rpc("submit_listing_edit", { p_id: listingId, p_changes: changes });
  if (error) {
    const known = { too_soon: "tooSoon", in_review: "inReview", edit_in_review: "editInReview" } as const;
    return { error: known[error.message as keyof typeof known] ?? "notAllowed" };
  }
  // Equipamento da própria Hi Scoot: a edição vale na hora (decisão de 20/10/2026).
  if (isAdmin) {
    if (data === "resent") {
      const { error: reviewError } = await supabase.rpc("review_listing", { p_id: listingId, p_approve: true, p_reason: null });
      if (!reviewError) redirect("/host/equipment?sent=published");
    } else {
      const { data: edit } = await supabase
        .from("equipment_edits")
        .select("id")
        .eq("equipment_id", listingId)
        .eq("status", "pending")
        .maybeSingle();
      const { error: reviewError } = edit
        ? await supabase.rpc("review_listing_edit", { p_edit: edit.id, p_approve: true, p_reason: null })
        : { error: true };
      if (!reviewError) redirect("/host/equipment?sent=published");
    }
  }
  redirect(`/host/equipment?sent=${data === "resent" ? "resent" : "edit"}`);
}

export type AvailabilityState = { available?: boolean; error?: "notAllowed" };

/** Marcar indisponível ↔ Marcar disponível (só para anúncio aprovado). */
export async function setAvailability(listingId: string, available: boolean): Promise<AvailabilityState> {
  const listing = await getHostListing(listingId);
  if (!listing || listing.review_status !== "approved") return { error: "notAllowed" };
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.from("equipment").update({ is_available: available }).eq("id", listingId);
    if (error) return { error: "notAllowed" };
  }
  return { available };
}
