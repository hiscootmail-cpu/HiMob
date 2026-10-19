"use server";

import { getWorldProduct } from "@/lib/scoot-world";
import { checkBuyer, cleanBuyer, WORLD_LIMITS, type BuyerData, type CartLine, type CheckoutField } from "@/lib/scoot-world-rules";
import { getCurrentUser } from "@/lib/session";
import { placeStoreOrder, type PlaceOrderResult } from "@/lib/store-orders";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { exampleShippingRates } from "@/lib/mock/scoot-world";

/*
 * Carrinho e fechamento do pedido da Loja interna. Qualquer pessoa usa, com ou
 * sem conta. Preço, estoque e frete vêm sempre do banco, nunca do navegador.
 */

export type CartProduct = { id: string; name: string; price: number; stock: number; sizes: string[]; photo?: string };

/** Dados atuais dos produtos do carrinho (os escondidos ou apagados somem). */
export async function cartProducts(ids: string[]): Promise<CartProduct[]> {
  const unique = [...new Set(ids)].slice(0, 10);
  const products = await Promise.all(unique.map((id) => getWorldProduct(id)));
  return products
    .filter((p) => p?.active)
    .map((p) => ({ id: p!.id, name: p!.name, price: p!.price, stock: p!.stock, sizes: p!.sizes, photo: p!.photo }));
}

/** Frete fixo da região: primeiro a cidade, depois o estado todo. null = ainda não entregamos aí. */
export async function quoteShipping(state: string, city: string): Promise<number | null> {
  if (!supabaseConfigured()) {
    const norm = (v: string | null) => (v ?? "").trim().toLowerCase();
    const rate =
      exampleShippingRates.find((r) => r.state === state && r.city && norm(r.city) === norm(city)) ??
      exampleShippingRates.find((r) => r.state === state && !r.city);
    return rate?.price ?? null;
  }
  const supabase = await createClient();
  const { data } = await supabase.rpc("shipping_price", { p_state: state, p_city: city });
  return data === null || data === undefined ? null : Number(data);
}

export type CheckoutResult = PlaceOrderResult | { ok: false; error: "fields"; fields: CheckoutField[] } | { ok: false; error: "empty" };

export async function placeOrder(lines: CartLine[], buyer: BuyerData): Promise<CheckoutResult> {
  const items = (Array.isArray(lines) ? lines : [])
    .filter((l) => typeof l?.id === "string" && Number.isInteger(l?.quantity) && l.quantity >= 1 && l.quantity <= WORLD_LIMITS.perItem)
    .map((l) => ({ id: l.id, quantity: l.quantity, ...(typeof l.size === "string" && l.size ? { size: l.size.slice(0, WORLD_LIMITS.sizeLength) } : {}) }))
    .slice(0, 10);
  if (!items.length) return { ok: false, error: "empty" };
  const data = Object.fromEntries(
    (["name", "email", "phone", "cpf", "cep", "street", "number", "complement", "district", "city", "state"] as const).map((k) => [
      k,
      String(buyer?.[k] ?? ""),
    ]),
  ) as BuyerData;
  const fields = checkBuyer(data);
  if (fields.length) return { ok: false, error: "fields", fields };
  const user = supabaseConfigured() ? await getCurrentUser() : null;
  return placeStoreOrder(items, cleanBuyer(data), user?.id ?? null);
}
