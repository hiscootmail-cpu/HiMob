import { redactContacts } from "@/lib/contact-filter";
import { type EquipmentType } from "@/lib/equipment";
import { getEquipment } from "@/lib/equipment-db";
import { exampleConversations } from "@/lib/mock/conversations";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { publicName } from "@/lib/utils";

/*
 * Conversas (inventário de ações): lista + chat.
 * - Telefone e e-mail ficam ocultos até existir reserva aceita entre as duas
 *   pessoas para aquele equipamento. O servidor só entrega o contato depois disso.
 * - Mensagens novas chegam sozinhas (tempo real), só para as duas pessoas.
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
  /** Conversa ainda não existe no banco: nasce na primeira mensagem ("Falar com o Host"). */
  is_new?: boolean;
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

const SELECT = `
  id, rider_id, host_id,
  equipment(id, title, type),
  rider:profiles!conversations_rider_id_fkey(display_name, identity_status),
  host:profiles!conversations_host_id_fkey(display_name, identity_status),
  messages(id, sender_id, body, created_at, read_at)
`;

type Row = {
  id: string;
  rider_id: string;
  host_id: string;
  equipment: { id: string; title: string; type: EquipmentType } | null;
  rider: { display_name: string; identity_status: string } | null;
  host: { display_name: string; identity_status: string } | null;
  messages: { id: string; sender_id: string; body: string; created_at: string; read_at: string | null }[];
};

/** Conversas da pessoa conectada, lidas do banco (o banco não entrega as dos outros). */
async function realConversations(filter?: { id?: string; equipmentId?: string }): Promise<Conversation[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let query = supabase.from("conversations").select(SELECT);
  if (filter?.id) query = query.eq("id", filter.id);
  if (filter?.equipmentId) query = query.eq("equipment_id", filter.equipmentId).eq("rider_id", user.id);
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  // Contato liberado (reserva aceita) é conferido pelo banco, conversa por conversa.
  const unlocked = await Promise.all(
    rows.map(async (row) => Boolean((await supabase.rpc("contact_unlocked", { c: row.id })).data)),
  );

  return rows.map((row, i) => {
    const amRider = row.rider_id === user.id;
    const other = amRider ? row.host : row.rider;
    const messages = [...row.messages].sort((a, b) => a.created_at.localeCompare(b.created_at));
    return {
      id: row.id,
      equipment: { id: row.equipment?.id ?? "", title: row.equipment?.title ?? "", type: row.equipment?.type ?? "scooter" },
      other: { id: amRider ? row.host_id : row.rider_id, name: other?.display_name ?? "", verified: other?.identity_status === "approved" },
      my_role: amRider ? "rider" : "host",
      has_accepted_booking: unlocked[i],
      other_contact: null,
      unread: messages.filter((m) => m.sender_id !== user.id && !m.read_at).length,
      messages: messages.map((m) => ({ id: m.id, mine: m.sender_id === user.id, body: m.body, sent_at: m.created_at })),
    };
  });
}

/** Contato da outra pessoa: o banco só entrega com reserva aceita. */
async function withContact(conversation: Conversation): Promise<Conversation> {
  if (!conversation.has_accepted_booking) return conversation;
  const supabase = await createClient();
  const { data } = await supabase.rpc("conversation_contact", { c: conversation.id });
  const contact = (data as { phone: string; email: string }[] | null)?.[0];
  return { ...conversation, other_contact: contact ? { phone: contact.phone ?? "", email: contact.email ?? "" } : null };
}

/*
 * Com a Supabase: só as conversas de que a pessoa conectada participa.
 * Sem a Supabase (demonstração): os exemplos.
 */
export async function listConversations(): Promise<Conversation[]> {
  const list = supabaseConfigured() ? await realConversations() : exampleConversations;
  return list
    .map(protect)
    .sort((a, b) => (b.messages.at(-1)?.sent_at ?? "").localeCompare(a.messages.at(-1)?.sent_at ?? ""));
}

/**
 * Abre a conversa pelo id. Se o id for de um equipamento ("Falar com o Host"),
 * reaproveita a conversa sobre ele ou começa uma nova, vazia.
 */
export async function getConversation(id: string): Promise<Conversation | null> {
  if (supabaseConfigured()) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const byId = await realConversations({ id });
    const [found] = byId.length ? byId : await realConversations({ equipmentId: id });
    if (found) return protect(await withContact(found));
  } else {
    const found = exampleConversations.find((c) => c.id === id || (c.my_role === "rider" && c.equipment.id === id));
    if (found) return protect(found);
  }

  const equipment = await getEquipment(id);
  if (!equipment) return null;
  if (supabaseConfigured()) {
    // O Host não conversa com ele mesmo sobre o próprio anúncio.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.id === equipment.host_id) return null;
  }
  return {
    id,
    equipment: { id: equipment.id, title: equipment.title, type: equipment.type },
    other: { id: equipment.host.id, name: publicName(equipment.host.full_name), verified: equipment.host.verified },
    my_role: "rider",
    has_accepted_booking: false,
    other_contact: null,
    unread: 0,
    messages: [],
    is_new: true,
  };
}

/** Marca como lidas as mensagens recebidas nesta conversa. */
export async function markConversationRead(id: string): Promise<void> {
  if (!supabaseConfigured()) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("conversation_id", id).neq("sender_id", user.id).is("read_at", null);
}
