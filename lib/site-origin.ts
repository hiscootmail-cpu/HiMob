import "server-only";

import { headers } from "next/headers";

/**
 * Endereço do site (ex.: https://hi-mob.vercel.app), a partir do pedido atual.
 * Precisa bater com o endereço de retorno cadastrado no Mercado Pago.
 */
export async function siteOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "";
  const proto = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
