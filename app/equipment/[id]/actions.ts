"use server";

import { redirect } from "next/navigation";

import { unavailableDays } from "@/lib/availability";
import { firstConflict, todayInSaoPaulo, validateBookingDates, type BookingDatesError } from "@/lib/booking";
import { getEquipment } from "@/lib/equipment";

/*
 * PROVISÓRIO: nada é gravado ainda. As ações conferem os dados e simulam a
 * resposta. Quando o Supabase entrar, o servidor também confere se a pessoa
 * está conectada, se não é dona do anúncio, se o cadastro não está bloqueado
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
