
/*
 * Formato de um equipamento anunciado, como as telas recebem.
 * Campos vindos do inventário de ações (formulário "Publicar anúncio"):
 * tipo, título, descrição, preço por dia, cidade e localização.
 * Preço é SEMPRE por dia (daily_price), nunca por hora.
 *
 * Decisões de 09/10/2026:
 * - Fotos: no mínimo 4 e no máximo 10 por anúncio.
 * - Bairro (area) entra no cadastro do equipamento.
 * - Endereço exato só aparece depois que a reserva é confirmada.
 * - Aparecem as duas notas: a do equipamento e a do Host.
 * - Título e descrição ficam no idioma em que o Host escreveu (sem tradução).
 * - Preço por dia: cada Host define o seu. A Hi Scoot só sugere de R$ 30 a R$ 40.
 *   O Rider vê o preço com a taxa da plataforma (15%) somada: ver lib/pricing.ts.
 * - O Host define o horário de retirada e o de devolução do equipamento.
 *   (Futuro, fora do MVP: pontos 24 horas para retirar e devolver a qualquer hora.)
 * - Anúncio (publicado ou recusado) pode ser editado no máximo UMA vez a cada
 *   30 dias desde o último envio (EDIT_INTERVAL_DAYS); a edição volta para a
 *   análise. Reservas já feitas mantêm o preço do dia da reserva.
 * - Dias já reservados e dias bloqueados pelo Host não podem ser reservados
 *   (ver lib/availability.ts).
 */

export const EDIT_INTERVAL_DAYS = 30;

export const MIN_PHOTOS = 4;
export const MAX_PHOTOS = 10;

export type EquipmentType = "scooter" | "ebike";

export const equipmentTypes: EquipmentType[] = ["scooter", "ebike"];

export type EquipmentHost = {
  id: string;
  full_name: string;
  /** Identidade verificada (documento conferido). */
  verified: boolean;
  /** Ano em que virou Host ("Host desde 2026"). */
  host_since: number;
  /** Nota do Host, calculada a partir das avaliações que ele recebeu. */
  rating: { average: number; count: number } | null;
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
  /** Bairro mostrado antes da reserva (o endereço exato só depois da confirmação). */
  area: string;
  /** Endereços públicos das fotos (de 4 a 10). Vazio nos exemplos. */
  photos: string[];
  latitude: number;
  longitude: number;
  /** O Host pode marcar como indisponível em "Meus anúncios". */
  is_available: boolean;
  /** Horário de retirada definido pelo Host (HH:MM, horário de Brasília). */
  pickup_time: string;
  /** Horário de devolução definido pelo Host (HH:MM, horário de Brasília). */
  return_time: string;
  /** Nota do equipamento, calculada a partir das avaliações. */
  rating: { average: number; count: number } | null;
  host: EquipmentHost;
};

/** Centro de São Paulo: usado quando a pessoa não compartilha a localização. */
export const FALLBACK_LOCATION = { latitude: -23.5614, longitude: -46.6559 };

/*
 * A busca dos anúncios no banco fica em lib/equipment-db.ts (só no servidor),
 * porque este arquivo também é usado por telas que rodam no navegador.
 */

/** Raio da busca por proximidade, em km (inventário de ações). */
export const SEARCH_RADIUS_KM = 5;
