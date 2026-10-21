import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { IdentityStatus } from "@/lib/identity";
import { mercadoPagoConnected, mercadoPagoOn } from "@/lib/mercadopago/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

/*
 * Quem está conectado.
 * - Com a Supabase configurada (arquivo de chaves): login de verdade,
 *   conferido no servidor a cada pedido, e dados lidos do banco.
 * - Sem a Supabase: sessão de DEMONSTRAÇÃO. Entrar com a conta de teste grava
 *   um cookie simples; "Sair" apaga.
 */

export const DEMO_SESSION_COOKIE = "hs_demo_session";

export type CurrentUser = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  /** Estado (UF) da cidade onde mora; vazio = ainda não escolheu da lista (pede ao entrar). */
  city_state: string;
  /** Cidade secundária (opcional): trabalho, estudo, fim de semana. */
  second_city: string;
  second_city_state: string;
  /** Em viagem (aba Rider): cidade, estado e data de volta (AAAA-MM-DD). Vazio = sem viagem marcada. */
  travel_city: string;
  travel_city_state: string;
  travel_until: string;
  /** Já virou Host? (conta única: a mesma pessoa é Rider e Host) */
  is_host: boolean;
  /** Faz parte da equipe Hi Scoot? Só a equipe abre o painel do administrador. */
  is_admin: boolean;
  identity: IdentityStatus;
};

/** Pessoa de exemplo: o Rafael, que aluga e também é Host (e, só no teste, é da equipe). */
const demoUser: CurrentUser = {
  id: "host-rafael",
  full_name: "Rafael Santos",
  email: "teste@hiscoot.com.br",
  phone: "(11) 98765-4321",
  city: "São Paulo",
  city_state: "SP",
  second_city: "",
  second_city_state: "",
  travel_city: "",
  travel_city_state: "",
  travel_until: "",
  is_host: true,
  is_admin: true,
  identity: "approved",
};

export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
}

type ProfileRow = {
  city: string;
  city_state: string | null;
  second_city: string | null;
  second_city_state: string | null;
  travel_city?: string | null;
  travel_city_state?: string | null;
  travel_until?: string | null;
  is_host: boolean;
  identity_status: string;
  deleted_at: string | null;
};

const PROFILE_COLUMNS = "city, city_state, second_city, second_city_state, is_host, identity_status, deleted_at";

/**
 * Lê o perfil. Se o banco ainda não tiver os campos da viagem (atualização do
 * banco chegando depois do site), lê sem eles em vez de deixar a pessoa sem perfil.
 */
async function readProfile(supabase: Awaited<ReturnType<typeof createClient>>, id: string) {
  const full = await supabase
    .from("profiles")
    .select(`${PROFILE_COLUMNS}, travel_city, travel_city_state, travel_until`)
    .eq("id", id)
    .maybeSingle<ProfileRow>();
  if (!full.error) return full;
  return supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle<ProfileRow>();
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!supabaseConfigured()) {
    const store = await cookies();
    return store.get(DEMO_SESSION_COOKIE)?.value === "1" ? demoUser : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // As regras do banco só entregam a linha da própria pessoa.
  const [{ data: profile }, { data: secret }] = await Promise.all([
    readProfile(supabase, user.id),
    supabase.from("profile_private").select("full_name, phone, is_admin").eq("id", user.id).maybeSingle(),
  ]);

  // Conta excluída (decisão de 19/10/2026): vale como ninguém conectado.
  if (profile?.deleted_at) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: secret?.full_name ?? "",
    phone: secret?.phone ?? "",
    city: profile?.city ?? "",
    city_state: profile?.city_state ?? "",
    second_city: profile?.second_city ?? "",
    second_city_state: profile?.second_city_state ?? "",
    travel_city: profile?.travel_city ?? "",
    travel_city_state: profile?.travel_city_state ?? "",
    travel_until: profile?.travel_until ?? "",
    is_host: profile?.is_host ?? false,
    is_admin: secret?.is_admin ?? false,
    identity: (profile?.identity_status as IdentityStatus | undefined) ?? "pending",
  };
}

/**
 * Telas só para quem está conectado: sem sessão, vai para a tela de entrada.
 * Conta Mercado Pago só para quem recebe (decisão de 20/10/2026): cadastrar
 * equipamento e responder pedidos de reserva pedem { mercadoPago: true } e, com
 * o Mercado Pago ligado, levam para a conexão. Quem só paga (Rider, comprador)
 * usa PIX ou cartão de qualquer banco, sem conta no Mercado Pago.
 * A equipe Hi Scoot fica de fora (a conta dela é a da própria plataforma).
 */
export async function requireUser(options: { mercadoPago?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (options.mercadoPago && !user.is_admin && (await mercadoPagoOn()) && !(await mercadoPagoConnected())) {
    redirect("/mercado-pago/connect");
  }
  return user;
}

/**
 * Documento só na hora de alugar ou anunciar (decisão de 20/10/2026): o
 * cadastro não pede documento. Diz o que falta para a pessoa poder alugar e
 * anunciar: "send" (ainda não enviou, ou precisa reenviar), "review" (enviado,
 * esperando a equipe) ou null (aprovada).
 */
export async function identityStep(user: Pick<CurrentUser, "id" | "identity" | "is_admin">): Promise<"send" | "review" | null> {
  // A equipe cadastra os equipamentos da própria Hi Scoot sem as regras do Host (decisão de 20/10/2026).
  if (user.identity === "approved" || user.is_admin) return null;
  if (!supabaseConfigured()) return "send";
  const supabase = await createClient();
  const { count } = await supabase
    .from("identity_submissions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending");
  return count ? "review" : "send";
}

/** Viagem que ainda vale hoje (até a data de volta, inclusive). */
export function activeTravel(user: CurrentUser | null, today: string): { city: string; uf: string; until: string } | null {
  if (!user?.travel_city || !user.travel_city_state || !user.travel_until || user.travel_until < today) return null;
  return { city: user.travel_city, uf: user.travel_city_state, until: user.travel_until };
}
