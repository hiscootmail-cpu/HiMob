import { addDays } from "@/lib/booking";
import type { Booking } from "@/lib/bookings";
import { EDIT_INTERVAL_DAYS, type Equipment } from "@/lib/equipment";
import { exampleHostBookings, exampleHostListings } from "@/lib/mock/host";

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
 * PROVISÓRIO (a confirmar quando o banco for desenhado): os nomes dos campos
 * de análise abaixo ainda não existem no banco.
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

/*
 * PROVISÓRIO: devolve os exemplos. Quando o Supabase entrar, busca só os
 * anúncios e as reservas do Host conectado, no servidor.
 */
export async function listHostListings(): Promise<HostListing[]> {
  return exampleHostListings;
}

export async function getHostListing(id: string): Promise<HostListing | null> {
  return exampleHostListings.find((item) => item.id === id) ?? null;
}

export async function listHostBookings(): Promise<HostBooking[]> {
  return exampleHostBookings;
}

export async function getHostBooking(id: string): Promise<HostBooking | null> {
  return exampleHostBookings.find((item) => item.id === id) ?? null;
}
