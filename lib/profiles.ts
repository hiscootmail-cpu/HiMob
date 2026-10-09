import { type Equipment } from "@/lib/equipment";
import { listEquipment } from "@/lib/equipment-db";
import { exampleProfiles } from "@/lib/mock/profiles";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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

type Rating = { average: number; count: number } | null;

function rating(values: number[]): Rating {
  if (!values.length) return null;
  return { average: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10, count: values.length };
}

/** Perfil lido do banco: só a parte pública (a tabela privada nem é consultada). */
async function getRealProfile(id: string): Promise<{ profile: PublicProfile; listings: Equipment[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("profiles")
    .select("id, display_name, city, is_host, identity_status, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!row) return null;

  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, comment, target_role, created_at, author:profiles!reviews_author_id_fkey(display_name)")
    .eq("target_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  const list = reviews ?? [];

  return {
    profile: {
      id: row.id,
      name: row.display_name,
      city: row.city,
      member_since: new Date(row.created_at).getFullYear(),
      verified: row.identity_status === "approved",
      is_host: row.is_host,
      host_rating: rating(list.filter((r) => r.target_role === "host").map((r) => r.rating)),
      rider_rating: rating(list.filter((r) => r.target_role === "rider").map((r) => r.rating)),
      reviews: list
        .filter((r) => r.comment)
        .map((r) => ({
          id: r.id,
          author: (r.author as unknown as { display_name: string } | null)?.display_name ?? "",
          as: r.target_role === "host" ? ("host" as const) : ("rider" as const),
          rating: r.rating,
          comment: r.comment,
          date: String(r.created_at).slice(0, 10),
        })),
    },
    // Os anúncios passam a vir do banco na etapa 3.
    listings: [],
  };
}

/* Sem a Supabase (demonstração): devolve os exemplos. */
export async function getPublicProfile(id: string): Promise<{ profile: PublicProfile; listings: Equipment[] } | null> {
  if (supabaseConfigured()) return getRealProfile(id);
  const profile = exampleProfiles.find((p) => p.id === id);
  if (!profile) return null;
  const listings = profile.is_host ? (await listEquipment()).filter((e) => e.host_id === id) : [];
  return { profile, listings };
}
