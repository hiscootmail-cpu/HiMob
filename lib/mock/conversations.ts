import type { Conversation } from "@/lib/conversations";

/*
 * CONVERSAS DE EXEMPLO da conta de teste (Rafael): como Rider, com Hosts de
 * outros equipamentos, e como Host, com Riders dos equipamentos dele.
 * Telefones e e-mails são inventados.
 */

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const exampleConversations: Conversation[] = [
  {
    id: "cv-ana",
    equipment: { id: "eq-aro10-jardins", title: "Patinete Aro 10", type: "scooter" },
    other: { id: "rider-ana", name: "Ana P.", verified: true },
    my_role: "host",
    has_accepted_booking: false,
    other_contact: { phone: "(11) 95555-0101", email: "ana@exemplo.com" },
    unread: 1,
    messages: [
      { id: "m1", mine: false, body: "Oi! O patinete aguenta subida? Moro perto da Paulista.", sent_at: ago(180) },
      { id: "m2", mine: true, body: "Oi, Ana! Aguenta sim, subidas leves sem problema.", sent_at: ago(170) },
      { id: "m3", mine: false, body: "Ótimo! Me chama no 11 95555-0101 para combinar?", sent_at: ago(120) },
    ],
  },
  {
    id: "cv-camila",
    equipment: { id: "eq-bike-vila-nova", title: "Bike elétrica urbana", type: "ebike" },
    other: { id: "host-camila", name: "Camila F.", verified: true },
    my_role: "rider",
    has_accepted_booking: true,
    other_contact: { phone: "(11) 99876-1234", email: "camila@exemplo.com" },
    unread: 0,
    messages: [
      { id: "m1", mine: true, body: "Oi, Camila! A bike vem com cadeado?", sent_at: ago(1500) },
      { id: "m2", mine: false, body: "Vem sim, com cadeado e capacete.", sent_at: ago(1440) },
      { id: "m3", mine: false, body: "Reserva aceita! Se precisar, meu telefone é (11) 99876-1234.", sent_at: ago(600) },
    ],
  },
  {
    id: "cv-marina",
    equipment: { id: "eq-aro10-jardins", title: "Patinete Aro 10", type: "scooter" },
    other: { id: "rider-marina", name: "Marina L.", verified: true },
    my_role: "host",
    has_accepted_booking: true,
    other_contact: { phone: "(11) 97777-2222", email: "marina@exemplo.com" },
    unread: 0,
    messages: [
      { id: "m1", mine: false, body: "Obrigada por aceitar! Vou pagar hoje.", sent_at: ago(3000) },
      { id: "m2", mine: true, body: "Combinado. A retirada é às 09:00.", sent_at: ago(2950) },
    ],
  },
];
