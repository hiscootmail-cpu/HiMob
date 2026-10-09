import type { PublicProfile } from "@/lib/profiles";

/* PERFIS DE EXEMPLO, só para conferir as telas. Nomes e comentários inventados. */

export const exampleProfiles: PublicProfile[] = [
  {
    id: "host-rafael",
    name: "Rafael S.",
    city: "São Paulo",
    member_since: 2026,
    verified: true,
    is_host: true,
    host_rating: { average: 4.9, count: 32 },
    rider_rating: { average: 5, count: 3 },
    reviews: [
      { id: "r1", author: "Diego S.", as: "host", rating: 5, comment: "Patinete impecável e entrega no horário.", date: "2026-09-20" },
      { id: "r2", author: "Camila F.", as: "rider", rating: 5, comment: "Devolveu a bike limpa e no horário.", date: "2026-09-12" },
      { id: "r3", author: "Lucas T.", as: "host", rating: 4, comment: "Tudo certo, só atrasou uns minutos.", date: "2026-08-30" },
    ],
  },
  {
    id: "host-camila",
    name: "Camila F.",
    city: "São Paulo",
    member_since: 2026,
    verified: true,
    is_host: true,
    host_rating: { average: 4.7, count: 15 },
    rider_rating: null,
    reviews: [{ id: "r1", author: "Rafael S.", as: "host", rating: 5, comment: "Bike ótima, recomendo.", date: "2026-09-10" }],
  },
  {
    id: "host-bruno",
    name: "Bruno M.",
    city: "São Paulo",
    member_since: 2026,
    verified: false,
    is_host: true,
    host_rating: null,
    rider_rating: null,
    reviews: [],
  },
  ...["ana:Ana P.", "lucas:Lucas T.", "marina:Marina L.", "joao:João V.", "beatriz:Beatriz R.", "pedro:Pedro A.", "carla:Carla D.", "diego:Diego S.", "fernanda:Fernanda C."].map(
    (entry): PublicProfile => {
      const [id, name] = entry.split(":");
      return {
        id: `rider-${id}`,
        name,
        city: "São Paulo",
        member_since: 2026,
        verified: true,
        is_host: false,
        host_rating: null,
        rider_rating: id === "diego" ? { average: 5, count: 1 } : null,
        reviews: [],
      };
    },
  ),
];
