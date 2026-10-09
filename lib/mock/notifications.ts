import type { Notification } from "@/lib/notifications";

/* AVISOS DE EXEMPLO da conta de teste (Rafael), só para conferir as telas. */

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const exampleNotifications: Notification[] = [
  { id: "nt-01", kind: "bookingRequest", created_at: ago(1), read: false, needs_action: true, href: "/host/reservations#hb-2001", name: "Ana P.", title: "Patinete Aro 10" },
  { id: "nt-02", kind: "newMessage", created_at: ago(2), read: false, needs_action: true, href: "/conversations/cv-ana", name: "Ana P." },
  { id: "nt-03", kind: "bookingAccepted", created_at: ago(5), read: false, needs_action: true, href: "/rider/reservations/rv-1002/payment", name: "Rafael S.", title: "Patinete Aro 10" },
  { id: "nt-04", kind: "pickupReminder", created_at: ago(9), read: true, needs_action: false, href: "/rider/reservations/rv-1003", title: "Bike elétrica urbana" },
  { id: "nt-05", kind: "paymentConfirmed", created_at: ago(26), read: true, needs_action: false, href: "/rider/reservations/rv-1003", title: "Bike elétrica urbana" },
  { id: "nt-06", kind: "returnConfirmed", created_at: ago(50), read: true, needs_action: true, href: "/rider/reservations/rv-1005/review", title: "Patinete leve" },
  { id: "nt-07", kind: "reviewReceived", created_at: ago(72), read: true, needs_action: false, href: "/profile/host-rafael", name: "Diego S." },
  { id: "nt-08", kind: "listingRejected", created_at: ago(120), read: true, needs_action: false, href: "/host/equipment", title: "Patinete urbano" },
  { id: "nt-09", kind: "listingApproved", created_at: ago(240), read: true, needs_action: false, href: "/host/equipment", title: "Patinete Pro" },
  { id: "nt-10", kind: "bookingRejected", created_at: ago(400), read: true, needs_action: false, href: "/rider/reservations/rv-1007", title: "Patinete Pro" },
  { id: "nt-11", kind: "documentApproved", created_at: ago(700), read: true, needs_action: false, href: "/verify-identity" },
];
