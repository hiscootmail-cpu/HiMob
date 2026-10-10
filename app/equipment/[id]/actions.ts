"use server";

import { redirect } from "next/navigation";

import { unavailableDays } from "@/lib/availability";
import { firstConflict, todayInSaoPaulo, validateBookingDates, type BookingDatesError } from "@/lib/booking";
import { getEquipment } from "@/lib/equipment-db";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Pedido de reserva. Com a Supabase, a função do banco confere de novo se a
 * pessoa está conectada, se não é dona do anúncio, se o cadastro não está
 * bloqueado e se os dias estão livres, e guarda o preço do anúncio.
 * Sem a Supabase (demonstração): confere os dados e simula a resposta.
 * Dias já reservados e dias bloqueados pelo Host já são recusados aqui.
 */

export type BookingRequestState = {
  error?: BookingDatesError | "unavailable" | "datesUnavailable";
  done?: boolean;
};

export async function requestBooking(
  equipmentId: string,
  _prev: BookingRequestState,
  formData: FormData,
): Promise<BookingRequestState> {
  const equipment = await getEquipment(equipmentId);
  if (!equipment || !equipment.is_available) return { error: "unavailable" };

  const pickup = String(formData.get("pickup") ?? "");
  const dropoff = String(formData.get("return") ?? "");
  const error = validateBookingDates(pickup, dropoff, todayInSaoPaulo());
  if (error) return { error };

  const { booked, blocked } = await unavailableDays(equipmentId);
  if (firstConflict(pickup, dropoff, [...booked, ...blocked])) return { error: "datesUnavailable" };

  // O valor é sempre recalculado no servidor (diárias x daily_price), nunca vem do navegador.
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/auth/login");
    const { error } = await supabase.rpc("request_booking", { p_equipment: equipmentId, p_start: pickup, p_end: dropoff });
    if (error) {
      const known = {
        dates_unavailable: "datesUnavailable",
        pickup_in_past: "pickupInPast",
        return_before_pickup: "returnBeforePickup",
      } as const;
      return { error: known[error.message as keyof typeof known] ?? "unavailable" };
    }
  }
  return { done: true };
}

export type WaitlistState = { onWaitlist: boolean };

/** "Avisar quando disponível" e "Cancelar aviso" alternam a mesma lista de espera. */
export async function toggleWaitlist(_equipmentId: string, prev: WaitlistState): Promise<WaitlistState> {
  return { onWaitlist: !prev.onWaitlist };
}

/** "Falar com o Host": cria ou reaproveita a conversa e abre o chat. */
export async function startConversation(equipmentId: string) {
  redirect(`/conversations/${equipmentId}`);
}
