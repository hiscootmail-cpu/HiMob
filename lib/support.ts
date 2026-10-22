import "server-only";

import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Central de ajuda e SOS (decisão de 22/10/2026): atendimentos com a equipe,
 * com as mensagens salvas. A IA entra depois neste mesmo chat.
 */

export const HELP_TOPICS = ["payment", "booking", "handoff", "damage", "identity", "host", "other"] as const;
export const SOS_TOPICS = ["accident", "theft", "breakdown", "other"] as const;
export type SupportTopic = (typeof HELP_TOPICS)[number] | (typeof SOS_TOPICS)[number];
export const MESSAGE_MAX = 2000;

export type SupportMessage = { id: string; from_team: boolean; from_ai: boolean; body: string; created_at: string; mine: boolean };

export type SupportTicket = {
  id: string;
  kind: "help" | "sos";
  topic: SupportTopic;
  status: "open" | "answered" | "closed";
  booking_id: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  updated_at: string;
  user_name?: string;
  messages: SupportMessage[];
};

/** Exemplo da demonstração (sem Supabase). */
function exampleTickets(): SupportTicket[] {
  const now = Date.now();
  return [
    {
      id: "atendimento-exemplo-1",
      kind: "help",
      topic: "payment",
      status: "answered",
      booking_id: null,
      latitude: null,
      longitude: null,
      created_at: new Date(now - 3 * 3600_000).toISOString(),
      updated_at: new Date(now - 2 * 3600_000).toISOString(),
      user_name: "Rafael S.",
      messages: [
        { id: "m1", from_team: false, from_ai: false, mine: true, body: "Paguei a reserva e ainda aparece \"falta pagar\".", created_at: new Date(now - 3 * 3600_000).toISOString() },
        { id: "m2", from_team: true, from_ai: false, mine: false, body: "Oi, Rafael! O pagamento foi confirmado agora. Boa viagem!", created_at: new Date(now - 2 * 3600_000).toISOString() },
      ],
    },
  ];
}

const TICKET_COLUMNS = "id, kind, topic, status, booking_id, latitude, longitude, created_at, updated_at, user_id";

type TicketRow = Omit<SupportTicket, "messages" | "user_name"> & { user_id: string };

async function withMessages(rows: TicketRow[], meId: string, names?: Map<string, string>): Promise<SupportTicket[]> {
  if (!rows.length) return [];
  const supabase = await createClient();
  const ids = rows.map((r) => r.id);
  const full = await supabase.from("support_messages").select("id, ticket_id, author_id, from_team, from_ai, body, created_at").in("ticket_id", ids).order("created_at");
  // Se o banco ainda não tiver o campo da IA, lê sem ele.
  const { data } = full.error
    ? await supabase.from("support_messages").select("id, ticket_id, author_id, from_team, body, created_at").in("ticket_id", ids).order("created_at")
    : full;
  return rows.map((row) => ({
    ...row,
    user_name: names?.get(row.user_id),
    messages: (data ?? [])
      .filter((m) => m.ticket_id === row.id)
      .map((m) => ({
        id: m.id,
        from_team: m.from_team,
        from_ai: Boolean((m as { from_ai?: boolean }).from_ai),
        body: m.body,
        created_at: m.created_at,
        mine: m.author_id === meId,
      })),
  }));
}

/** Atendimentos da pessoa conectada, do mais recente para o mais antigo. */
export async function listMyTickets(): Promise<SupportTicket[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  if (!supabaseConfigured()) return exampleTickets();
  const supabase = await createClient();
  const { data } = await supabase.from("support_tickets").select(TICKET_COLUMNS).eq("user_id", user.id).order("updated_at", { ascending: false });
  return withMessages((data ?? []) as TicketRow[], user.id);
}

/** Um atendimento (da própria pessoa; a equipe vê todos). */
export async function getTicket(id: string): Promise<SupportTicket | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (!supabaseConfigured()) return exampleTickets().find((t) => t.id === id) ?? null;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("support_tickets").select(TICKET_COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: person } = await supabase.from("profiles").select("display_name").eq("id", (data as TicketRow).user_id).maybeSingle();
  const names = new Map([[(data as TicketRow).user_id, person?.display_name ?? ""]]);
  return (await withMessages([data as TicketRow], user.id, names))[0];
}

/** Painel: todos os atendimentos, SOS e abertos primeiro. */
export async function listAllTickets(): Promise<SupportTicket[]> {
  const user = await getCurrentUser();
  if (!user?.is_admin) return [];
  if (!supabaseConfigured()) return exampleTickets();
  const supabase = await createClient();
  const { data } = await supabase.from("support_tickets").select(TICKET_COLUMNS).order("updated_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as TicketRow[];
  const { data: people } = rows.length
    ? await supabase.from("profiles").select("id, display_name").in("id", [...new Set(rows.map((r) => r.user_id))])
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id as string, p.display_name as string]));
  const order = (t: SupportTicket) => (t.kind === "sos" && t.status !== "closed" ? 0 : t.status === "open" ? 1 : t.status === "answered" ? 2 : 3);
  return (await withMessages(rows, user.id, names)).sort((a, b) => order(a) - order(b));
}
