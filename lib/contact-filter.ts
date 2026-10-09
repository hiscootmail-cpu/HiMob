/*
 * Telefone e e-mail no chat ficam ocultos até existir reserva aceita entre as
 * duas pessoas para aquele equipamento (inventário de ações). O servidor
 * esconde ANTES de guardar e de mostrar: não adianta procurar na página.
 */

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 8 ou mais dígitos, com espaços, pontos, traços ou parênteses no meio (ex.: (11) 98765-4321).
// Mesma regra do banco (public.redact_contacts).
const PHONE = /\+?\d(?:[\s().-]*\d){7,}/g;

export const HIDDEN_MARK = "•••";

/** Tamanho máximo de uma mensagem do chat. */
export const MESSAGE_MAX = 1000;

export function redactContacts(text: string): { text: string; redacted: boolean } {
  const result = text.replace(EMAIL, HIDDEN_MARK).replace(PHONE, HIDDEN_MARK);
  return { text: result, redacted: result !== text };
}
