import { exampleEquipment } from "@/lib/mock/equipment";

/*
 * Formato de um equipamento anunciado, como as telas recebem.
 * Campos vindos do inventário de ações (formulário "Publicar anúncio"):
 * tipo, título, descrição, preço por dia, cidade e localização.
 * Preço é SEMPRE por dia (daily_price), nunca por hora.
 *
 * Em aberto (perguntas para a Scoot): fotos do anúncio, bairro/região
 * mostrado no cartão, e se a nota é do equipamento ou do Host.
 */

export type EquipmentType = "scooter" | "ebike";

export const equipmentTypes: EquipmentType[] = ["scooter", "ebike"];

export type EquipmentHost = {
  id: string;
  full_name: string;
  /** Identidade verificada (documento conferido). */
  verified: boolean;
  /** Ano em que virou Host ("Host desde 2026"). */
  host_since: number;
};

export type Equipment = {
  id: string;
  host_id: string;
  type: EquipmentType;
  title: string;
  description: string;
  /** Preço por dia, em reais. */
  daily_price: number;
  city: string;
  /** Bairro ou região mostrada antes da reserva (o endereço exato não aparece). EM ABERTO. */
  area: string;
  latitude: number;
  longitude: number;
  /** O Host pode marcar como indisponível em "Meus anúncios". */
  is_available: boolean;
  /** Calculado a partir das avaliações. EM ABERTO: nota do equipamento ou do Host. */
  rating: { average: number; count: number } | null;
  host: EquipmentHost;
};

/** Centro de São Paulo: usado quando a pessoa não compartilha a localização. */
export const FALLBACK_LOCATION = { latitude: -23.5614, longitude: -46.6559 };

/** Raio da busca por proximidade, em km (inventário de ações). */
export const SEARCH_RADIUS_KM = 5;

/*
 * PROVISÓRIO: devolve os exemplos. Quando o Supabase entrar, estas funções
 * buscam só anúncios aprovados, no servidor.
 */
export async function listEquipment(): Promise<Equipment[]> {
  return exampleEquipment;
}

export async function getEquipment(id: string): Promise<Equipment | null> {
  return exampleEquipment.find((item) => item.id === id) ?? null;
}
