"use server";

import { redirect } from "next/navigation";

import { todayInSaoPaulo } from "@/lib/booking";
import { editPolicy, getHostListing } from "@/lib/host";
import { readListingForm, validateListing, type ListingErrors } from "@/lib/listing";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * PROVISÓRIO: nada é gravado ainda. As ações conferem os dados no servidor e
 * simulam a resposta. Quando o Supabase entrar, o servidor também confere se
 * o anúncio é do Host conectado, guarda as fotos no armazenamento e gera o
 * código da etiqueta QR.
 */

/** "Quero ser Host": self-service, um clique (inventário de ações). */
export async function becomeHost() {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.rpc("become_host");
  }
  redirect("/host/equipment/new");
}

export type ListingState = { errors?: ListingErrors; error?: "notAllowed" };

/** Publicar anúncio: vai para a análise da equipe antes de aparecer na busca. */
export async function createListing(_prev: ListingState, formData: FormData): Promise<ListingState> {
  const errors = validateListing(readListingForm(formData));
  if (Object.keys(errors).length) return { errors };
  redirect("/host/equipment?sent=new");
}

/**
 * Editar anúncio: no máximo uma vez a cada 30 dias.
 * A edição volta para a análise; até lá, o anúncio antigo continua no ar.
 */
export async function updateListing(listingId: string, _prev: ListingState, formData: FormData): Promise<ListingState> {
  const listing = await getHostListing(listingId);
  if (!listing || !editPolicy(listing, todayInSaoPaulo()).allowed) return { error: "notAllowed" };

  const errors = validateListing(readListingForm(formData, true));
  if (Object.keys(errors).length) return { errors };
  redirect(`/host/equipment?sent=${listing.review_status === "rejected" ? "resent" : "edit"}`);
}

export type AvailabilityState = { available?: boolean; error?: "notAllowed" };

/** Marcar indisponível ↔ Marcar disponível (só para anúncio aprovado). */
export async function setAvailability(listingId: string, available: boolean): Promise<AvailabilityState> {
  const listing = await getHostListing(listingId);
  if (!listing || listing.review_status !== "approved") return { error: "notAllowed" };
  return { available };
}
