import { bookingBreakdown } from "@/lib/pricing";

/*
 * Divisão do pagamento no Mercado Pago (decisões de 19/10/2026).
 *
 * - O Rider paga o total da reserva (diárias + 15% da plataforma).
 * - O Mercado Pago desconta a taxa dele da parte do Host. Como a Hi Scoot paga
 *   essa taxa, a parte da Hi Scoot ("application_fee") é a taxa de 15% MENOS a
 *   taxa do Mercado Pago: assim o Host recebe exatamente o valor das diárias.
 * - Taxa pendente do Host (cancelou uma reserva paga) entra na parte da Hi
 *   Scoot do próximo pagamento dele.
 * - Cartão só à vista.
 *
 * Taxas da conta Hi Scoot no Mercado Pago (Checkout Transparente, recebimento
 * em 30 dias), informadas em 19/10/2026. PIX: falta a taxa (fica desligado até lá).
 */
export const MP_FEE_PERCENT: Record<PaymentMethod, number | null> = {
  card: 3.98,
  pix: null,
};

export type PaymentMethod = "pix" | "card";

export function methodEnabled(method: PaymentMethod): boolean {
  return MP_FEE_PERCENT[method] !== null;
}

const toCents = (reais: number) => Math.round(reais * 100);
const toReais = (cents: number) => cents / 100;

export type PaymentSplit = {
  /** Total que o Rider paga. */
  total: number;
  /** Parte da Hi Scoot no Mercado Pago (já sem a taxa do Mercado Pago, com a taxa pendente do Host). */
  applicationFee: number;
  /** Taxa estimada do Mercado Pago (paga pela Hi Scoot). */
  mpFee: number;
  /** Quanto da taxa pendente do Host entrou neste pagamento. */
  debtIncluded: number;
  /** Quanto o Host recebe (diárias menos a taxa pendente). */
  hostReceives: number;
};

export function paymentSplit(days: number, hostDailyPrice: number, method: PaymentMethod, hostDebt = 0): PaymentSplit {
  const rate = MP_FEE_PERCENT[method];
  if (rate === null) throw new Error(`method_disabled:${method}`);
  const price = bookingBreakdown(days, hostDailyPrice);
  const totalCents = toCents(price.total);
  const subtotalCents = toCents(price.subtotal);
  const feeCents = toCents(price.fee);
  const mpFeeCents = Math.round((totalCents * rate) / 100);
  // O Host nunca fica com valor negativo: a taxa pendente que não couber fica para a próxima.
  const debtCents = Math.min(Math.max(0, toCents(hostDebt)), subtotalCents);
  const applicationFeeCents = Math.max(0, feeCents - mpFeeCents) + debtCents;
  return {
    total: toReais(totalCents),
    applicationFee: toReais(applicationFeeCents),
    mpFee: toReais(mpFeeCents),
    debtIncluded: toReais(debtCents),
    hostReceives: toReais(subtotalCents - debtCents),
  };
}

/**
 * Cancelamento de reserva paga (regras de 09/10/2026 + decisão 3 de 19/10/2026):
 * - Rider cancela: recebe de volta as diárias; a taxa da plataforma fica.
 * - Host cancela: o Rider recebe tudo; a taxa de 15% fica pendente para o Host.
 * O Mercado Pago tira a devolução das duas partes (Host e Hi Scoot) na
 * proporção do que cada uma recebeu. Por isso, quando o Rider cancela, a parte
 * da taxa que o Host acabou guardando também fica pendente para ele.
 * ESTIMATIVA: conferir no primeiro teste com o Mercado Pago.
 */
export function cancelRefund(
  who: "rider" | "host",
  days: number,
  hostDailyPrice: number,
): { refund: number; hostDebt: number } {
  const price = bookingBreakdown(days, hostDailyPrice);
  const totalCents = toCents(price.total);
  const subtotalCents = toCents(price.subtotal);
  if (who === "host") return { refund: price.total, hostDebt: price.fee };
  const hostKeptCents = totalCents ? Math.round(subtotalCents - (subtotalCents * subtotalCents) / totalCents) : 0;
  return { refund: price.subtotal, hostDebt: toReais(hostKeptCents) };
}
