/*
 * Preço e taxas da plataforma.
 *
 * Preço por hora (decisão de 16/11/2026): o Host define o PREÇO POR HORA (o
 * que ele recebe por hora). A diária é o teto: se as horas passarem dela, vale
 * a diária. Anúncios antigos, sem preço por hora: hora = diária ÷ horas de
 * atendimento. Até 24 h: horas x preço por hora, sem passar de 1 diária. Cada
 * 24 h a mais conta 1 diária; o que sobra conta por hora, sem passar de 1 diária.
 * A mesma conta está no banco (public.rental_host_amount_hourly), que é quem
 * guarda o valor da reserva.
 *
 * Taxas (decisão de 26/10/2026), modelo "double" (reservas novas):
 * - 15% do Host, já no preço do anúncio: Host R$ 30,00 -> anúncio R$ 34,50.
 * - 15% do Rider sobre o preço do anúncio: Rider paga R$ 39,68.
 * - Host recebe R$ 30,00; Hi Scoot fica com R$ 9,68 (e paga a tarifa do Mercado Pago).
 * Modelo "single" (reservas feitas antes da mudança): só os 15% do Host.
 *
 * Tudo é calculado em centavos e arredondado para o centavo mais próximo.
 * O servidor sempre refaz esta conta; o valor nunca vem do navegador.
 */

export const PLATFORM_FEE_PERCENT = 15;

/** Qual regra de taxa vale para a reserva. Reservas novas: "double". */
export type FeeModel = "single" | "double";
export const CURRENT_FEE_MODEL: FeeModel = "double";

const toCents = (reais: number) => Math.round(reais * 100);
const toReais = (cents: number) => cents / 100;
const feeCents = (cents: number) => Math.round((cents * PLATFORM_FEE_PERCENT) / 100);

/** Preço do anúncio: valor do Host + 15% de taxa de operação do Host. */
export function listedPrice(hostPrice: number): number {
  const cents = toCents(hostPrice);
  return toReais(cents + feeCents(cents));
}

/** @deprecated nome antigo: o preço do anúncio (valor do Host + 15%). */
export const riderDailyPrice = listedPrice;

/** O que o Rider paga no total: preço do anúncio + 15% de taxa por operação. */
export function riderTotalPrice(hostPrice: number, model: FeeModel = CURRENT_FEE_MODEL): number {
  const listed = toCents(listedPrice(hostPrice));
  return toReais(model === "double" ? listed + feeCents(listed) : listed);
}

export type BookingBreakdown = {
  /** O que o Host recebe. */
  subtotal: number;
  /** Taxa de operação do Host (15% sobre o valor do Host). */
  hostFee: number;
  /** Preço do anúncio (valor do Host + taxa do Host). */
  listed: number;
  /** Taxa por operação do Rider (15% sobre o preço do anúncio; 0 no modelo antigo). */
  riderFee: number;
  /** Tudo o que fica para a Hi Scoot (taxa do Host + taxa do Rider). */
  fee: number;
  /** O que o Rider paga. */
  total: number;
};

/** Valor do Host -> preço do anúncio -> total do Rider. */
export function breakdownFromHost(hostAmount: number, model: FeeModel = CURRENT_FEE_MODEL): BookingBreakdown {
  const subtotalCents = toCents(hostAmount);
  const hostFeeCents = feeCents(subtotalCents);
  const listedCents = subtotalCents + hostFeeCents;
  const riderFeeCents = model === "double" ? feeCents(listedCents) : 0;
  return {
    subtotal: toReais(subtotalCents),
    hostFee: toReais(hostFeeCents),
    listed: toReais(listedCents),
    riderFee: toReais(riderFeeCents),
    fee: toReais(hostFeeCents + riderFeeCents),
    total: toReais(listedCents + riderFeeCents),
  };
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

/** Preço por hora do Host: o do anúncio ou, em anúncio antigo, diária ÷ horas de atendimento. */
export function hostHourlyPrice(hostDailyPrice: number, openFrom: string, openUntil: string, hourlyPrice?: number | null): number {
  if (hourlyPrice && hourlyPrice > 0) return hourlyPrice;
  return Math.round((hostDailyPrice / openHours(openFrom, openUntil)) * 100) / 100;
}

/** Valor do Host por um aluguel de tantas horas: preço por hora, com a diária como teto. */
export function rentalHostAmount(
  hostDailyPrice: number,
  openFrom: string,
  openUntil: string,
  hours: number,
  hourlyPrice?: number | null,
): number {
  if (hours <= 0) return 0;
  const hourly = hourlyPrice && hourlyPrice > 0 ? hourlyPrice : hostDailyPrice / openHours(openFrom, openUntil);
  const fullDays = Math.floor(hours / 24);
  const rest = hours - fullDays * 24;
  const amount = fullDays * hostDailyPrice + Math.min(hostDailyPrice, rest * hourly);
  return Math.round(amount * 100) / 100;
}

export type DiscountedBreakdown = BookingBreakdown & {
  /** Desconto do cupom no aluguel (sai da parte do Host). */
  rentalDiscount: number;
  /** Desconto do cupom nas taxas (sai da parte da Hi Scoot). */
  feeDiscount: number;
  /** Total sem o cupom. */
  fullTotal: number;
};

/**
 * Preço com cupom de desconto (20/10/2026): x% no aluguel (parte do Host) e
 * y% nas taxas (parte da Hi Scoot). Cupom grátis: 100% e 100%.
 */
export function discountedBreakdown(
  hostAmount: number,
  rentalPercent = 0,
  feePercent = 0,
  model: FeeModel = CURRENT_FEE_MODEL,
): DiscountedBreakdown {
  const full = breakdownFromHost(hostAmount, model);
  const clamp = (v: number) => Math.min(100, Math.max(0, v)) / 100;
  const subtotalCents = toCents(full.subtotal);
  const rentalCents = Math.round(subtotalCents * clamp(rentalPercent));
  const hostFeeCents = toCents(full.hostFee) - Math.round(toCents(full.hostFee) * clamp(feePercent));
  const riderFeeCents = toCents(full.riderFee) - Math.round(toCents(full.riderFee) * clamp(feePercent));
  const subtotal = subtotalCents - rentalCents;
  return {
    subtotal: toReais(subtotal),
    hostFee: toReais(hostFeeCents),
    listed: toReais(subtotal + hostFeeCents),
    riderFee: toReais(riderFeeCents),
    fee: toReais(hostFeeCents + riderFeeCents),
    total: toReais(subtotal + hostFeeCents + riderFeeCents),
    rentalDiscount: toReais(rentalCents),
    feeDiscount: toReais(toCents(full.fee) - hostFeeCents - riderFeeCents),
    fullTotal: full.total,
  };
}

// -----------------------------------------------------------------------------
// Preço sugerido para o Host (decisão de 16/11/2026), por hora, no que ele recebe.
// Referência: patinete compartilhado em capital (~R$ 37/h para o Rider em 2025)
// = Host ~R$ 28/h com as duas taxas. Mínimo da Hi Scoot: R$ 30/h para o Host.
// Turismo e alta temporada: o Host decide.
// -----------------------------------------------------------------------------

/** Capitais (nome da cidade + UF), para a faixa sugerida de capital. */
const CAPITALS = new Set([
  "Rio Branco|AC", "Maceió|AL", "Macapá|AP", "Manaus|AM", "Salvador|BA", "Fortaleza|CE", "Brasília|DF", "Vitória|ES",
  "Goiânia|GO", "São Luís|MA", "Cuiabá|MT", "Campo Grande|MS", "Belo Horizonte|MG", "Belém|PA", "João Pessoa|PB",
  "Curitiba|PR", "Recife|PE", "Teresina|PI", "Rio de Janeiro|RJ", "Natal|RN", "Porto Alegre|RS", "Porto Velho|RO",
  "Boa Vista|RR", "Florianópolis|SC", "São Paulo|SP", "Aracaju|SE", "Palmas|TO",
]);

export type PriceSuggestion = { min: number; max: number; tier: "capital" | "interior"; dailyHours: number };

const SUGGESTED: Record<"scooter" | "ebike" | "eskate", Record<"capital" | "interior", [number, number]>> = {
  scooter: { capital: [30, 40], interior: [30, 30] },
  eskate: { capital: [30, 40], interior: [30, 30] },
  ebike: { capital: [30, 35], interior: [30, 30] },
};

/** Faixa sugerida por hora para o tipo e a cidade. Jetboard: sem referência (o Host define). */
export function suggestedHourly(type: string, city: string | null, uf: string | null): PriceSuggestion | null {
  if (type !== "scooter" && type !== "ebike" && type !== "eskate") return null;
  const tier = city && uf && CAPITALS.has(`${city}|${uf}`) ? "capital" : "interior";
  const [min, max] = SUGGESTED[type][tier];
  return { min, max, tier, dailyHours: 6 };
}
