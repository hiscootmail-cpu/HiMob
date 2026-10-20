/*
 * Regras de horário usadas no navegador e no servidor (decisões de 20/10/2026).
 * Um aluguel aceito ocupa do horário de retirada até 1 hora depois da devolução.
 */

/** Intervalo entre um aluguel e o próximo (carregar e conferir o patinete). */
export const GAP_HOURS = 1;

export type Schedule = {
  /** Dias liberados pelo Host, de hoje em diante (AAAA-MM-DD). */
  available: string[];
  /** Horários já ocupados (milissegundos), sem o intervalo de 1 hora. */
  busy: { start: number; end: number }[];
};
