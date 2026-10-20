import type { Equipment } from "@/lib/equipment";
import { discountedBreakdown, type DiscountedBreakdown } from "@/lib/pricing";

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
  /** Dias do calendário que a reserva ocupa (retirada e devolução no mesmo dia = 1). */
  days: number;
  /** Duração em horas (aluguel por horas, decisão de 20/10/2026). */
  hours: number;
  /** Valor do Host por dia no momento da reserva (o preço do anúncio pode mudar depois). */
  host_daily_price: number;
  /** Valor do Host por esta reserva, antes da taxa (guardado pelo banco). */
  host_amount: number;
  /** Hora de retirada e de devolução escolhidas pelo Rider (HH:MM, horário de Brasília). */
  pickup_time: string;
  return_time: string;
  status: BookingStatus;
  /** Endereço exato de retirada: só existe para o Rider depois do pagamento confirmado. */
  pickup_address: string | null;
  /** O Rider já avaliou esta reserva? */
  rider_reviewed: boolean;
  /** Motivo curto escrito pelo Host ao recusar (decisão de 10/10/2026). */
  reject_reason?: string | null;
  /** Cupom usado no pedido (ex.: SCOOTEMMOGI). */
  coupon_code?: string | null;
  /** Aluguel grátis (cupom de ação): confirmado sem pagamento, ninguém recebe. */
  free?: boolean;
  /** Cupom de desconto: % no aluguel (parte do Host) e % na taxa (parte da Hi Scoot). */
  coupon_rental_percent?: number;
  coupon_fee_percent?: number;
  /**
   * Quem já confirmou a retirada e a devolução. A reserva só segue quando os
   * dois confirmam (decisão de 10/10/2026); sem isso, a equipe verifica em 2 horas.
   */
  confirmed?: Record<"pickup" | "return", { rider: boolean; host: boolean }>;
};

/** Prazo para a outra pessoa confirmar antes de a equipe Hi Scoot verificar. */
export const HANDOFF_WAIT_HOURS = 2;

/** Motivo da recusa: curto (decisão de 10/10/2026). */
export const REJECT_REASON = { min: 5, max: 100 } as const;

export function validRejectReason(reason: string) {
  const length = reason.trim().length;
  return length >= REJECT_REASON.min && length <= REJECT_REASON.max;
}

/** Tamanho máximo do comentário da avaliação. */
export const REVIEW_COMMENT_MAX = 500;

/** Situações em que a reserva ainda está acontecendo. */
export const ONGOING: BookingStatus[] = ["pending", "accepted", "confirmed", "active"];

export function bookingPrice(booking: Booking): DiscountedBreakdown {
  return discountedBreakdown(booking.host_amount, booking.coupon_rental_percent ?? 0, booking.coupon_fee_percent ?? 0);
}

// Leitura das reservas (banco ou exemplos): lib/bookings-db.ts (só no servidor).
