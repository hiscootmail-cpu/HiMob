import { exampleNotifications } from "@/lib/mock/notifications";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Notificações (lista aprovada em 09/10/2026). Cada aviso diz em poucas
 * palavras quem fez o quê e leva direto à tela certa.
 */

export const notificationKinds = [
  "bookingRequest",
  "bookingAccepted",
  "bookingRejected",
  "paymentConfirmed",
  "pickupReminder",
  "returnConfirmed",
  "reviewReceived",
  "listingApproved",
  "listingRejected",
  "documentApproved",
  "documentRejected",
  "newMessage",
] as const;

export type NotificationKind = (typeof notificationKinds)[number];

export type Notification = {
  id: string;
  kind: NotificationKind;
  /** Data e hora (ISO). */
  created_at: string;
  read: boolean;
  /** Pede uma ação da pessoa (filtro "Precisam de mim"). */
  needs_action: boolean;
  /** Tela que o aviso abre. */
  href: string;
  /** Nome da outra pessoa e/ou título do equipamento, para o texto do aviso. */
  name?: string;
  title?: string;
};

/*
 * Com a Supabase: os avisos da pessoa conectada (o banco não entrega os de outras).
 * Sem a Supabase (demonstração): os exemplos.
 */
export async function listNotifications(): Promise<Notification[]> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select("id, kind, created_at, read, needs_action, href, name, title")
      .order("created_at", { ascending: false })
      .limit(100);
    return (data ?? []).map((n) => ({ ...n, name: n.name ?? undefined, title: n.title ?? undefined })) as Notification[];
  }
  return [...exampleNotifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function unreadCount(): Promise<number> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
    return count ?? 0;
  }
  return exampleNotifications.filter((n) => !n.read).length;
}

/** Marcar todas como lidas (na demonstração, muda só os exemplos na memória). */
export async function markAllNotificationsRead(): Promise<void> {
  if (supabaseConfigured()) {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    return;
  }
  exampleNotifications.forEach((n) => (n.read = true));
}
