"use server";

import { redactContacts } from "@/lib/contact-filter";
import { getConversation, MESSAGE_MAX, type Message } from "@/lib/conversations";
import { getCurrentUser } from "@/lib/session";

/*
 * PROVISÓRIO: a mensagem não é gravada ainda. O servidor confere e devolve a
 * mensagem como ficaria guardada. Com o Supabase, ela é gravada e chega
 * sozinha para a outra pessoa (tempo real).
 */

export type SendState = { message?: Message; redacted?: boolean; error?: "empty" | "tooLong" | "notAllowed" };

export async function sendMessage(conversationId: string, _prev: SendState, formData: FormData): Promise<SendState> {
  const [user, conversation] = await Promise.all([getCurrentUser(), getConversation(conversationId)]);
  if (!user || !conversation) return { error: "notAllowed" };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "empty" };
  if (body.length > MESSAGE_MAX) return { error: "tooLong" };

  // Sem reserva aceita, telefone e e-mail são escondidos antes de guardar.
  const { text, redacted } = conversation.has_accepted_booking ? { text: body, redacted: false } : redactContacts(body);
  return {
    message: { id: `m-${Date.now()}`, mine: true, body: text, sent_at: new Date().toISOString() },
    redacted,
  };
}
