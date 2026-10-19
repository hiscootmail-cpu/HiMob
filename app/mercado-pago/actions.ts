"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { authorizationUrl, MP_OAUTH_COOKIE, mercadoPagoServerReady, newPkce } from "@/lib/mercadopago/server";
import { getCurrentUser } from "@/lib/session";
import { siteOrigin } from "@/lib/site-origin";

/** "Conectar Mercado Pago": leva a pessoa para autorizar a Hi Scoot na conta dela. */
export async function startMercadoPagoConnect() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!mercadoPagoServerReady()) redirect("/mercado-pago/connect?error=unavailable");

  const { verifier, challenge, state } = newPkce();
  const store = await cookies();
  store.set(MP_OAUTH_COOKIE, JSON.stringify({ verifier, state, user: user.id }), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/mercado-pago",
    maxAge: 600,
  });
  redirect(authorizationUrl(await siteOrigin(), state, challenge));
}
