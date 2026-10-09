import type { Equipment } from "@/lib/equipment";
import { exampleBookings } from "@/lib/mock/bookings";
import { supabaseConfigured } from "@/lib/supabase/config";
import { bookingBreakdown, type BookingBreakdown } from "@/lib/pricing";

/*
 * Reserva, do ponto de vista do Rider.
 *
 * Situações (status), na ordem do caminho:
 * - pending    aguardando o Host aceitar        → Cancelar
 * - accepted   Host aceitou, falta pagar        → Pagar / Cancelar
 * - confirmed  pago, pronto para retirada       → Confirmar retirada (QR + foto)
 * - active     em uso                           → Confirmar devolução (QR + foto)
 * - completed  devolvido                        → Avaliar (se ainda não avaliou)
 * - rejected   Host recusou
 * - cancelled  cancelada
 *
 * Cancelamento e reembolso: ver lib/cancellation.ts (decisão de 09/10/2026).
 */

export type BookingStatus = "pending" | "accepted" | "confirmed" | "active" | "completed" | "rejected" | "cancelled";

export type Booking = {
  id: string;
  equipment: Equipment;
  rider_id: string;
  /** Retirada e devolução, no formato AAAA-MM-DD. */
  start_date: string;
  end_date: string;
  days: number;
  /** Valor do Host por dia no momento da reserva (o preço do anúncio pode mudar depois). */
  host_daily_price: number;
  /** Horários do anúncio no momento da reserva (HH:MM, horário de Brasília). */
  pickup_time: string;
  return_time: string;
  status: BookingStatus;
  /** Endereço exato de retirada: só existe para o Rider depois do pagamento confirmado. */
  pickup_address: string | null;
  /** O Rider já avaliou esta reserva? */
  rider_reviewed: boolean;
};

/** Tamanho máximo do comentário da avaliação. */
export const REVIEW_COMMENT_MAX = 500;

/** Situações em que a reserva ainda está acontecendo. */
export const ONGOING: BookingStatus[] = ["pending", "accepted", "confirmed", "active"];

export function bookingPrice(booking: Booking): BookingBreakdown {
  return bookingBreakdown(booking.days, booking.host_daily_price);
}

/*
 * Sem a Supabase (demonstração): devolve os exemplos.
 * Com a Supabase: as reservas passam a vir do banco na etapa 4; até lá, a
 * lista fica vazia (nunca mistura exemplo com conta de verdade).
 */
export async function listRiderBookings(): Promise<Booking[]> {
  return supabaseConfigured() ? [] : exampleBookings;
}

export async function getRiderBooking(id: string): Promise<Booking | null> {
  if (supabaseConfigured()) return null;
  return exampleBookings.find((booking) => booking.id === id) ?? null;
}
