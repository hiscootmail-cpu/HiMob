import { listEquipment, type Equipment } from "@/lib/equipment";
import { exampleProfiles } from "@/lib/mock/profiles";

/*
 * Perfil público (inventário de ações): nome, selos (Host / Identidade
 * verificada), avaliações e, se for Host, os anúncios publicados.
 * Nunca mostra telefone, e-mail, documento ou endereço.
 */

export type ProfileReview = {
  id: string;
  author: string;
  /** O autor avaliou esta pessoa como Host ou como Rider. */
  as: "host" | "rider";
  rating: number;
  comment: string;
  /** AAAA-MM-DD */
  date: string;
};

export type PublicProfile = {
  id: string;
  /** Nome curto (primeiro nome + inicial). */
  name: string;
  city: string;
  member_since: number;
  verified: boolean;
  is_host: boolean;
  host_rating: { average: number; count: number } | null;
  rider_rating: { average: number; count: number } | null;
  reviews: ProfileReview[];
};

/*
 * PROVISÓRIO: devolve os exemplos. Com o Supabase, uma consulta pública que
 * só traz os campos acima.
 */
export async function getPublicProfile(id: string): Promise<{ profile: PublicProfile; listings: Equipment[] } | null> {
  const profile = exampleProfiles.find((p) => p.id === id);
  if (!profile) return null;
  const listings = profile.is_host ? (await listEquipment()).filter((e) => e.host_id === id) : [];
  return { profile, listings };
}
