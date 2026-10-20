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
 * Aluguel por horas (decisão de 20/10/2026): o Host informa só a diária.
 * Hora = diária ÷ horas de atendimento do Host. Até 24 h: horas usadas, sem
 * passar de 1 diária. Cada 24 h a mais conta 1 diária; o que sobra conta por
 * hora, sem passar de 1 diária. A mesma conta está no banco
 * (public.rental_host_amount), que é quem guarda o valor da reserva.
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

/** "HH:MM" → minutos desde 00:00. */
const minutesOf = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Horas de atendimento do Host. Fim igual ou antes do início = atende 24 h. */
export function openHours(openFrom: string, openUntil: string): number {
  const span = minutesOf(openUntil) - minutesOf(openFrom);
  return span > 0 ? span / 60 : 24;
}

/** Valor do Host por hora (antes da taxa). */
export function hostHourlyPrice(hostDailyPrice: number, openFrom: string, openUntil: string): number {
  return Math.round((hostDailyPrice / openHours(openFrom, openUntil)) * 100) / 100;
}

/** Valor do Host por um aluguel de tantas horas (antes da taxa). */
export function rentalHostAmount(hostDailyPrice: number, openFrom: string, openUntil: string, hours: number): number {
  if (hours <= 0) return 0;
  const fullDays = Math.floor(hours / 24);
  const rest = hours - fullDays * 24;
  const amount = fullDays * hostDailyPrice + Math.min(hostDailyPrice, (rest * hostDailyPrice) / openHours(openFrom, openUntil));
  return Math.round(amount * 100) / 100;
}

/** Valor do Host + 15% da plataforma = o que o Rider paga. */
export function breakdownFromHost(hostAmount: number): BookingBreakdown {
  const subtotalCents = toCents(hostAmount);
  const fee = feeCents(subtotalCents);
  return { subtotal: toReais(subtotalCents), fee: toReais(fee), total: toReais(subtotalCents + fee) };
}

export type DiscountedBreakdown = BookingBreakdown & {
  /** Desconto do cupom no aluguel (sai da parte do Host). */
  rentalDiscount: number;
  /** Desconto do cupom na taxa (sai da parte da Hi Scoot). */
  feeDiscount: number;
  /** Total sem o cupom. */
  fullTotal: number;
};

/**
 * Preço com cupom de desconto (20/10/2026): x% no aluguel e y% na taxa.
 * subtotal = o que o Host recebe; fee = o que fica para a Hi Scoot.
 */
export function discountedBreakdown(hostAmount: number, rentalPercent = 0, feePercent = 0): DiscountedBreakdown {
  const full = breakdownFromHost(hostAmount);
  const subtotalCents = toCents(full.subtotal);
  const feeFullCents = toCents(full.fee);
  const rentalCents = Math.round((subtotalCents * Math.min(100, Math.max(0, rentalPercent))) / 100);
  const feeCutCents = Math.round((feeFullCents * Math.min(100, Math.max(0, feePercent))) / 100);
  return {
    subtotal: toReais(subtotalCents - rentalCents),
    fee: toReais(feeFullCents - feeCutCents),
    total: toReais(subtotalCents - rentalCents + feeFullCents - feeCutCents),
    rentalDiscount: toReais(rentalCents),
    feeDiscount: toReais(feeCutCents),
    fullTotal: full.total,
  };
}
