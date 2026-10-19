import type { WorldPlace, WorldProduct, WorldVideo } from "@/lib/scoot-world-rules";

/*
 * DADOS DE EXEMPLO, só para conferir as telas do Mundo Scoot.
 * Não são produtos, lojas ou oficinas reais. A HiTV fica vazia aqui porque
 * os vídeos de verdade são cadastrados pela equipe no painel.
 */

export const exampleWorldProducts: WorldProduct[] = [
  {
    id: "produto-exemplo-capacete",
    name: "Capacete Hi Scoot (exemplo)",
    description: "Produto de exemplo para conferir a tela. A equipe cadastra os produtos de verdade no painel.",
    price: 189.9,
    active: true,
  },
  {
    id: "produto-exemplo-camiseta",
    name: "Camiseta Hi Scoot (exemplo)",
    description: "Produto de exemplo para conferir a tela.",
    price: 79,
    active: true,
  },
];

export const exampleWorldVideos: WorldVideo[] = [];

export const exampleWorldPlaces: WorldPlace[] = [
  {
    id: "local-exemplo-oficina",
    kind: "workshop",
    name: "Oficina de exemplo",
    address: "Rua de Exemplo, 100 - Centro",
    city: "Campinas",
    phone: "19999990000",
    services: "Troca de pneu, revisão de freio e bateria",
    latitude: -22.9056,
    longitude: -47.0608,
    active: true,
  },
  {
    id: "local-exemplo-parceira",
    kind: "partner",
    name: "Loja parceira de exemplo",
    address: "Avenida de Exemplo, 200 - Cambuí",
    city: "Campinas",
    phone: null,
    services: "Acessórios e peças",
    latitude: -22.8945,
    longitude: -47.0505,
    active: true,
  },
];
