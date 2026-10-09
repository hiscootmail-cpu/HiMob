import type { AdminIdentity, AdminListing } from "@/lib/admin";

/* FILAS DE EXEMPLO do painel do administrador, só para conferir a tela. */

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export const exampleListingQueue: AdminListing[] = [
  {
    id: "eq-novo-itaim",
    kind: "new",
    title: "Patinete Aro 8,5",
    type: "scooter",
    description: "Patinete leve, ótimo para trajetos curtos. Autonomia de cerca de 20 km.",
    daily_price: 32,
    area: "Itaim Bibi",
    city: "São Paulo",
    photos_count: 5,
    host: { id: "host-rafael", name: "Rafael S.", verified: true },
    sent_at: ago(48),
  },
  {
    id: "eq-novo-mooca",
    kind: "new",
    title: "Bike elétrica com cesto",
    type: "ebike",
    description: "Bike elétrica com cesto dianteiro. Bateria para cerca de 45 km.",
    daily_price: 38,
    area: "Mooca",
    city: "São Paulo",
    photos_count: 4,
    host: { id: "host-camila", name: "Camila F.", verified: true },
    sent_at: ago(20),
  },
  {
    id: "eq-bike-moema",
    kind: "edit",
    title: "Bike elétrica dobrável",
    type: "ebike",
    description: "Bike elétrica dobrável, cabe no porta-malas. Bateria para cerca de 40 km.",
    daily_price: 42,
    area: "Moema",
    city: "São Paulo",
    photos_count: 6,
    host: { id: "host-rafael", name: "Rafael S.", verified: true },
    sent_at: ago(30),
    changes: [
      { field: "daily_price", before: "R$ 40,00", after: "R$ 42,00" },
      { field: "photos", before: "4", after: "6" },
    ],
  },
];

export const exampleIdentityQueue: AdminIdentity[] = [
  { id: "id-01", user_id: "rider-joao", full_name: "João Vitor Almeida", sent_at: ago(30), kind: "document", rejections: 0 },
  { id: "id-02", user_id: "rider-carla", full_name: "Carla Dias", sent_at: ago(12), kind: "document", rejections: 1 },
  { id: "id-03", user_id: "rider-pedro", full_name: "Pedro Alves", sent_at: ago(6), kind: "letter", rejections: 1 },
];
