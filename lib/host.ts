import { addDays } from "@/lib/booking";
import { realBookings } from "@/lib/bookings-db";
import type { Booking } from "@/lib/bookings";
import { EDIT_INTERVAL_DAYS, type Equipment } from "@/lib/equipment";
import { exampleHostBookings, exampleHostListings } from "@/lib/mock/host";
import { supabaseConfigured } from "@/lib/supabase/config";
import { equipmentPhotoUrl } from "@/lib/supabase/photos";
import { createClient } from "@/lib/supabase/server";

/*
 * Área do Host (Lote 5).
 *
 * Anúncio do ponto de vista do Host: o equipamento + a análise da equipe Hi Scoot.
 * Inventário do painel do administrador: "Anúncios pendentes: Motivo + Rejeitar / Aprovar".
 *
 * Decisões de 09/10/2026:
 * - Anúncio pode ser editado no máximo UMA vez a cada 30 dias, contados do
 *   último envio (criação ou edição). Vale também para anúncio recusado:
 *   o Host não reenvia na hora (decisão de 09/10/2026).
 * - A edição volta para a análise da equipe. Enquanto isso, o anúncio antigo
 *   continua no ar, sem mudança.
 * - O QR fica numa etiqueta colada no equipamento; o Host imprime aqui.
 *
 * Os campos abaixo vêm das tabelas equipment, equipment_private e
 * equipment_edits (supabase/migrations).
 */

export type ListingReview = "pending" | "approved" | "rejected";

export type HostListing = Equipment & {
  /** Situação da análise da equipe. */
  review_status: ListingReview;
  /** Motivo escrito pela equipe quando recusa. */
  review_reason: string | null;
  /** Data do último envio para análise, criação ou edição (AAAA-MM-DD). Conta os 30 dias a partir dela. */
  last_sent_at: string | null;
  /** Existe uma edição esperando a análise? (O anúncio antigo segue no ar.) */
  edit_in_review: boolean;
  /** Endereço exato de retirada: o Rider só vê depois do pagamento. */
  pickup_address: string;
  /** Código escrito embaixo do QR da etiqueta. Só o Host e o servidor conhecem. */
  label_code: string;
};

export type EditPolicy =
  | { allowed: true }
  | { allowed: false; reason: "inReview" | "editInReview" | "tooSoon"; nextDate?: string };

/**
 * Pode editar agora?
 * - Em análise (anúncio novo): ainda não.
 * - Publicado ou recusado: uma vez a cada 30 dias desde o último envio,
 *   e só se não houver outra edição em análise.
 */
export function editPolicy(listing: HostListing, today: string): EditPolicy {
  if (listing.review_status === "pending") return { allowed: false, reason: "inReview" };
  if (listing.edit_in_review) return { allowed: false, reason: "editInReview" };
  if (listing.last_sent_at) {
    const nextDate = addDays(listing.last_sent_at, EDIT_INTERVAL_DAYS);
    if (today < nextDate) return { allowed: false, reason: "tooSoon", nextDate };
  }
  return { allowed: true };
}

/** Reserva do ponto de vista do Host: com o nome do Rider e a avaliação que o Host faz dele. */
export type HostBooking = Booking & {
  rider: { id: string; full_name: string; verified: boolean };
  /** O Host já avaliou o Rider desta reserva? */
  host_reviewed: boolean;
};

type HostRow = {
  id: string;
  host_id: string;
  type: HostListing["type"];
  title: string;
  description: string;
  daily_price: number;
  city: string;
  area: string;
  latitude: number | null;
  longitude: number | null;
  pickup_time: string;
  return_time: string;
  is_available: boolean;
  review_status: ListingReview;
  review_reason: string | null;
  last_sent_at: string;
  equipment_private: { pickup_address: string; latitude: number; longitude: number; label_code: string } | null;
  equipment_photos: { path: string; position: number }[];
  equipment_edits: { status: string }[];
};

/** Anúncios do Host conectado, lidos do banco (com os dados privados que só ele vê). */
async function realHostListings(id?: string): Promise<HostListing[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase
    .from("equipment")
    .select(
      "id, host_id, type, title, description, daily_price, city, area, latitude, longitude, pickup_time, return_time, is_available, review_status, review_reason, last_sent_at, equipment_private(pickup_address, latitude, longitude, label_code), equipment_photos(path, position), equipment_edits(status)",
    )
    .eq("host_id", user.id)
    .order("created_at", { ascending: false });
  if (id) query = query.eq("id", id);
  const { data } = await query;

  return ((data ?? []) as unknown as HostRow[]).map((row) => ({
    id: row.id,
    host_id: row.host_id,
    type: row.type,
    title: row.title,
    description: row.description,
    daily_price: Number(row.daily_price),
    city: row.city,
    area: row.area,
    // O Host vê o ponto exato do próprio anúncio.
    latitude: row.equipment_private?.latitude ?? row.latitude ?? 0,
    longitude: row.equipment_private?.longitude ?? row.longitude ?? 0,
    photos: [...row.equipment_photos].sort((a, b) => a.position - b.position).map((p) => equipmentPhotoUrl(p.path)),
    is_available: row.is_available,
    pickup_time: row.pickup_time.slice(0, 5),
    return_time: row.return_time.slice(0, 5),
    rating: null,
    host: { id: row.host_id, full_name: "", verified: true, host_since: new Date().getFullYear(), rating: null },
    review_status: row.review_status,
    review_reason: row.review_reason,
    last_sent_at: new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(row.last_sent_at)),
    edit_in_review: row.equipment_edits.some((e) => e.status === "pending"),
    pickup_address: row.equipment_private?.pickup_address ?? "",
    label_code: row.equipment_private?.label_code ?? "",
  }));
}

/*
 * Com a Supabase: os anúncios do Host conectado (o banco não entrega os de
 * outras pessoas). Sem a Supabase (demonstração): os exemplos.
 * Reservas recebidas: as do banco em que a pessoa conectada é o Host.
 */
export async function listHostListings(): Promise<HostListing[]> {
  return supabaseConfigured() ? realHostListings() : exampleHostListings;
}

export async function getHostListing(id: string): Promise<HostListing | null> {
  if (supabaseConfigured()) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    return (await realHostListings(id))[0] ?? null;
  }
  return exampleHostListings.find((item) => item.id === id) ?? null;
}

export async function listHostBookings(): Promise<HostBooking[]> {
  return supabaseConfigured() ? realBookings("host") : exampleHostBookings;
}

export async function getHostBooking(id: string): Promise<HostBooking | null> {
  if (supabaseConfigured()) return (await realBookings("host", id))[0] ?? null;
  return exampleHostBookings.find((item) => item.id === id) ?? null;
}
