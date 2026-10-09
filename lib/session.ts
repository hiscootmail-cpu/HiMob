import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { IdentityStatus } from "@/lib/identity";
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
  is_host: true,
  is_admin: true,
  identity: "approved",
};

export async function isSignedIn(): Promise<boolean> {
  return (await getCurrentUser()) !== null;
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
    supabase.from("profiles").select("city, is_host, identity_status").eq("id", user.id).maybeSingle(),
    supabase.from("profile_private").select("full_name, phone, is_admin").eq("id", user.id).maybeSingle(),
  ]);

  return {
    id: user.id,
    email: user.email ?? "",
    full_name: secret?.full_name ?? "",
    phone: secret?.phone ?? "",
    city: profile?.city ?? "",
    is_host: profile?.is_host ?? false,
    is_admin: secret?.is_admin ?? false,
    identity: (profile?.identity_status as IdentityStatus | undefined) ?? "pending",
  };
}

/** Telas só para quem está conectado: sem sessão, vai para a tela de entrada. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}
