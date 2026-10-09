import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { IdentityStatus } from "@/lib/identity";

/*
 * PROVISÓRIO até o Supabase entrar: sessão de DEMONSTRAÇÃO.
 * Entrar com a conta de teste grava um cookie simples; "Sair" apaga.
 * Com o Supabase, quem diz se a pessoa está conectada é o login de verdade,
 * conferido no servidor a cada pedido.
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
  const store = await cookies();
  return store.get(DEMO_SESSION_COOKIE)?.value === "1";
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  return (await isSignedIn()) ? demoUser : null;
}

/** Telas só para quem está conectado: sem sessão, vai para a tela de entrada. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  return user;
}
