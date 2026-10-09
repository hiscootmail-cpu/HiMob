import { exampleNotifications } from "@/lib/mock/notifications";

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
 * PROVISÓRIO: devolve os exemplos. Com o Supabase, busca só os avisos da
 * pessoa conectada, no servidor.
 */
export async function listNotifications(): Promise<Notification[]> {
  return [...exampleNotifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function unreadCount(): Promise<number> {
  return exampleNotifications.filter((n) => !n.read).length;
}

/** Marcar todas como lidas. PROVISÓRIO: muda só os exemplos, na memória do servidor. */
export async function markAllNotificationsRead(): Promise<void> {
  exampleNotifications.forEach((n) => (n.read = true));
}
