import { redactContacts } from "@/lib/contact-filter";
import { type EquipmentType } from "@/lib/equipment";
import { getEquipment } from "@/lib/equipment-db";
import { exampleConversations } from "@/lib/mock/conversations";
import { supabaseConfigured } from "@/lib/supabase/config";
import { publicName } from "@/lib/utils";

/*
 * Conversas (inventário de ações): lista + chat.
 * - Telefone e e-mail ficam ocultos até existir reserva aceita entre as duas
 *   pessoas para aquele equipamento. O servidor só entrega o contato depois disso.
 * - Mensagens novas chegam sozinhas (tempo real) quando o Supabase entrar.
 */

export { MESSAGE_MAX } from "@/lib/contact-filter";

export type Message = {
  id: string;
  /** Mensagem escrita pela pessoa conectada? */
  mine: boolean;
  body: string;
  /** Data e hora (ISO). */
  sent_at: string;
};

export type Conversation = {
  id: string;
  equipment: { id: string; title: string; type: EquipmentType };
  /** A outra pessoa da conversa. */
  other: { id: string; name: string; verified: boolean };
  /** Meu papel nesta conversa. */
  my_role: "rider" | "host";
  /** Existe reserva aceita entre as duas pessoas para este equipamento? */
  has_accepted_booking: boolean;
  /** Contato da outra pessoa: só existe com reserva aceita. */
  other_contact: { phone: string; email: string } | null;
  unread: number;
  messages: Message[];
};

/** Aplica a regra de contato oculto antes de a conversa sair do servidor. */
function protect(conversation: Conversation): Conversation {
  if (conversation.has_accepted_booking) return conversation;
  return {
    ...conversation,
    other_contact: null,
    messages: conversation.messages.map((m) => ({ ...m, body: redactContacts(m.body).text })),
  };
}

/*
 * PROVISÓRIO: devolve os exemplos. Com o Supabase, só as conversas de que a
 * pessoa conectada participa (o banco recusa as outras).
 */
export async function listConversations(): Promise<Conversation[]> {
  // Com a Supabase, as conversas passam a vir do banco na etapa 5.
  if (supabaseConfigured()) return [];
  return exampleConversations
    .map(protect)
    .sort((a, b) => (b.messages.at(-1)?.sent_at ?? "").localeCompare(a.messages.at(-1)?.sent_at ?? ""));
}

/**
 * Abre a conversa pelo id. Se o id for de um equipamento ("Falar com o Host"),
 * reaproveita a conversa sobre ele ou começa uma nova, vazia.
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  const found = supabaseConfigured() ? undefined : exampleConversations.find((c) => c.id === id || (c.my_role === "rider" && c.equipment.id === id));
  if (found) return protect(found);

  const equipment = await getEquipment(id);
  if (!equipment) return null;
  return {
    id,
    equipment: { id: equipment.id, title: equipment.title, type: equipment.type },
    other: { id: equipment.host.id, name: publicName(equipment.host.full_name), verified: equipment.host.verified },
    my_role: "rider",
    has_accepted_booking: false,
    other_contact: null,
    unread: 0,
    messages: [],
  };
}
