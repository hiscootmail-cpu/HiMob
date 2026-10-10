"use server";

import { redactContacts } from "@/lib/contact-filter";
import { getConversation, MESSAGE_MAX, type Message } from "@/lib/conversations";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Com a Supabase: a mensagem é gravada (o banco esconde telefone e e-mail sem
 * reserva aceita) e chega sozinha para a outra pessoa (tempo real).
 * Sem a Supabase (demonstração): o servidor confere e devolve a mensagem como
 * ficaria guardada.
 */

export type SendState = {
  message?: Message;
  redacted?: boolean;
  /** Id da conversa no banco (criada na primeira mensagem). */
  conversationId?: string;
  error?: "empty" | "tooLong" | "notAllowed";
};

export async function sendMessage(conversationId: string, _prev: SendState, formData: FormData): Promise<SendState> {
  const [user, conversation] = await Promise.all([getCurrentUser(), getConversation(conversationId)]);
  if (!user || !conversation) return { error: "notAllowed" };

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "empty" };
  if (body.length > MESSAGE_MAX) return { error: "tooLong" };

  if (supabaseConfigured()) {
    const supabase = await createClient();
    let realId = conversation.id;
    if (conversation.is_new) {
      // "Falar com o Host": a conversa nasce na primeira mensagem.
      const { data, error } = await supabase.rpc("start_conversation", { p_equipment: conversation.equipment.id });
      if (error || !data) return { error: "notAllowed" };
      realId = data as string;
    }
    const { data: saved, error } = await supabase
      .from("messages")
      .insert({ conversation_id: realId, sender_id: user.id, body })
      .select("id, body, created_at")
      .single();
    if (error || !saved) return { error: "notAllowed" };
    return {
      message: { id: saved.id, mine: true, body: saved.body, sent_at: saved.created_at },
      redacted: saved.body !== body,
      conversationId: realId,
    };
  }

  // Sem reserva aceita, telefone e e-mail são escondidos antes de guardar.
  const { text, redacted } = conversation.has_accepted_booking ? { text: body, redacted: false } : redactContacts(body);
  return {
    message: { id: `m-${Date.now()}`, mine: true, body: text, sent_at: new Date().toISOString() },
    redacted,
  };
}
