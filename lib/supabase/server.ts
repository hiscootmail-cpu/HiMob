import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Cliente da Supabase no servidor, com a sessão da pessoa conectada (cookies).
 * Tudo o que ele lê e grava passa pelas regras de segurança do banco.
 */
export async function createClient() {
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Em páginas (sem permissão de gravar cookie) o proxy.ts renova a sessão.
        }
      },
    },
  });
}

/**
 * Cliente da equipe (chave secreta), SÓ no servidor e só para o que a pessoa
 * ainda não pode fazer sozinha: guardar o documento do cadastro antes de ela
 * confirmar o e-mail. A chave secreta fica no arquivo de chaves, nunca no Git.
 */
export function createSecretClient() {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  return createPlainClient(SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}
