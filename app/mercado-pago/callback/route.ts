import { NextResponse, type NextRequest } from "next/server";

import { connectAccount, MP_OAUTH_COOKIE } from "@/lib/mercadopago/server";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-origin";

/*
 * Volta do Mercado Pago depois que a pessoa autorizou a Hi Scoot.
 * Confere que é a mesma pessoa e a mesma tentativa (state + PKCE) antes de
 * guardar as chaves da conta.
 */
export async function GET(request: NextRequest) {
  const origin = await siteOrigin();
  const fail = NextResponse.redirect(`${origin}/mercado-pago/connect?error=failed`);
  fail.cookies.delete({ name: MP_OAUTH_COOKIE, path: "/mercado-pago" });

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const raw = request.cookies.get(MP_OAUTH_COOKIE)?.value;
  if (!code || !state || !raw) return fail;

  let saved: { verifier: string; state: string; user: string };
  try {
    saved = JSON.parse(raw);
  } catch {
    return fail;
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== saved.user || state !== saved.state) return fail;

  const connected = await connectAccount(user.id, code, saved.verifier, origin);
  if (!connected) return fail;

  const done = NextResponse.redirect(`${origin}/dashboard?mp=connected`);
  done.cookies.delete({ name: MP_OAUTH_COOKIE, path: "/mercado-pago" });
  return done;
}
