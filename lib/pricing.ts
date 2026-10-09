/*
 * Preço e taxa da plataforma (decisões de 09/10/2026).
 *
 * - Cada Host define o próprio preço por dia (daily_price). A Hi Scoot só
 *   sugere uma faixa: de R$ 30 a R$ 40 por dia.
 * - Taxa da plataforma: 15% sobre o valor do Host.
 * - Para o Rider, o preço por dia já aparece com os 15% somados
 *   (Host define R$ 30 → Rider vê R$ 34,50 por dia).
 * - Na reserva: "R$ 51,75 x 2 diárias = R$ 103,50" e, na linha de baixo,
 *   "Inclui 15% de taxa da plataforma (R$ 13,50), cobrada do Rider".
 *
 * Tudo é calculado em centavos para não errar arredondamento.
 * O servidor sempre refaz esta conta; o valor nunca vem do navegador.
 */

export const PLATFORM_FEE_PERCENT = 15;

export const SUGGESTED_DAILY_PRICE = { min: 30, max: 40 } as const;

const toCents = (reais: number) => Math.round(reais * 100);
const toReais = (cents: number) => cents / 100;
const feeCents = (cents: number) => Math.round((cents * PLATFORM_FEE_PERCENT) / 100);

/** Preço por dia que o Rider vê (valor do Host + 15%). */
export function riderDailyPrice(hostDailyPrice: number): number {
  const cents = toCents(hostDailyPrice);
  return toReais(cents + feeCents(cents));
}

export type BookingBreakdown = {
  /** Diárias x valor do Host. */
  subtotal: number;
  /** Taxa da plataforma (15% do subtotal). */
  fee: number;
  /** O que o Rider paga. */
  total: number;
};

export function bookingBreakdown(days: number, hostDailyPrice: number): BookingBreakdown {
  // O total é diárias x preço que o Rider vê (já com a taxa), para bater com o
  // número mostrado por dia. A taxa é a diferença para o valor do Host.
  const n = Math.max(0, days);
  const hostCents = toCents(hostDailyPrice);
  const subtotalCents = n * hostCents;
  const totalCents = n * (hostCents + feeCents(hostCents));
  return { subtotal: toReais(subtotalCents), fee: toReais(totalCents - subtotalCents), total: toReais(totalCents) };
}
