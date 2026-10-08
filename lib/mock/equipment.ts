import type { Equipment } from "@/lib/equipment";

/*
 * DADOS DE EXEMPLO, só para conferir as telas. Não são anúncios reais.
 * Títulos e descrições são escritos pelo Host, no idioma que ele escolher,
 * por isso não passam pela tradução PT/EN da interface.
 */

const rafael = { id: "host-rafael", full_name: "Rafael S.", verified: true, host_since: 2026, rating: { average: 4.9, count: 32 } };
const camila = { id: "host-camila", full_name: "Camila F.", verified: true, host_since: 2026, rating: { average: 4.7, count: 15 } };
const bruno = { id: "host-bruno", full_name: "Bruno M.", verified: false, host_since: 2026, rating: null };

export const exampleEquipment: Equipment[] = [
  {
    id: "eq-aro10-jardins",
    host_id: rafael.id,
    type: "scooter",
    title: "Patinete Aro 10",
    description:
      "Patinete elétrico aro 10, autonomia de cerca de 30 km. Acompanha capacete e carregador. Retirada combinada pelo chat.",
    daily_price: 45,
    city: "São Paulo",
    area: "Jardins",
    latitude: -23.5649,
    longitude: -46.6631,
    photos: [],
    is_available: true,
    rating: { average: 4.9, count: 24 },
    host: rafael,
  },
  {
    id: "eq-bike-vila-nova",
    host_id: camila.id,
    type: "ebike",
    title: "Bike elétrica urbana",
    description: "Bike elétrica com cesto e farol. Bateria para cerca de 50 km. Ideal para o dia a dia.",
    daily_price: 60,
    city: "São Paulo",
    area: "Vila Nova Conceição",
    latitude: -23.5872,
    longitude: -46.6714,
    photos: [],
    is_available: true,
    rating: { average: 4.7, count: 11 },
    host: camila,
  },
  {
    id: "eq-pro-pinheiros",
    host_id: rafael.id,
    type: "scooter",
    title: "Patinete Pro",
    description: "Patinete com suspensão dianteira, bom para ruas com buracos. Autonomia de cerca de 40 km.",
    daily_price: 55,
    city: "São Paulo",
    area: "Pinheiros",
    latitude: -23.5667,
    longitude: -46.6869,
    photos: [],
    is_available: true,
    rating: { average: 4.8, count: 9 },
    host: rafael,
  },
  {
    id: "eq-dobravel-paulista",
    host_id: bruno.id,
    type: "ebike",
    title: "Bike elétrica dobrável",
    description: "Dobrável, cabe no porta-malas e no metrô fora do horário de pico. Autonomia de cerca de 35 km.",
    daily_price: 50,
    city: "São Paulo",
    area: "Paulista",
    latitude: -23.5614,
    longitude: -46.6559,
    photos: [],
    is_available: true,
    rating: null,
    host: bruno,
  },
  {
    id: "eq-leve-vila-madalena",
    host_id: camila.id,
    type: "scooter",
    title: "Patinete leve",
    description: "Patinete leve (12 kg), fácil de carregar no colo. Autonomia de cerca de 20 km.",
    daily_price: 35,
    city: "São Paulo",
    area: "Vila Madalena",
    latitude: -23.5531,
    longitude: -46.6905,
    photos: [],
    is_available: false,
    rating: { average: 4.6, count: 5 },
    host: camila,
  },
];
