import { addDays, todayInSaoPaulo } from "@/lib/booking";

/*
 * DIAS BLOQUEADOS PELO HOST, de exemplo.
 * PROVISÓRIO: fica na memória do servidor só para conferir as telas (some ao
 * reiniciar). Com o Supabase, vira uma tabela própria (equipamento + dia).
 */

const today = todayInSaoPaulo();

export const exampleBlockedDays = new Map<string, Set<string>>([
  ["eq-aro10-jardins", new Set([addDays(today, 20), addDays(today, 21)])],
  ["eq-pro-pinheiros", new Set([addDays(today, 14)])],
]);
