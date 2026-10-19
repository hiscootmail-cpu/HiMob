import "server-only";

import { timingSafeEqual } from "node:crypto";

import { pixExpiration } from "@/lib/mercadopago/booking-payments";
import { createMpPayment, getMpPayment, refundMpPayment } from "@/lib/mercadopago/server";
import { exampleWorldProducts } from "@/lib/mock/scoot-world";
import { ORDER_COLUMNS, toOrder } from "@/lib/scoot-world";
import type { BuyerData, CartLine, StoreOrder } from "@/lib/scoot-world-rules";
import { siteOrigin } from "@/lib/site-origin";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient, createSecretClient } from "@/lib/supabase/server";

/*
 * Compra na Loja interna do Mundo Scoot (decisões de 20/10/2026).
 * Qualquer pessoa compra, com ou sem conta, e paga por PIX. O dinheiro cai na
 * conta Mercado Pago da própria Hi Scoot (sem divisão com Host).
 * Chave secreta (configurações da Vercel, nunca no Git):
 * - MP_ACCESS_TOKEN: Access Token da conta Mercado Pago da Hi Scoot.
 * O preço e o frete são sempre recalculados pelo banco; o navegador só manda
 * quais produtos, quantos e os dados de entrega.
 */

const hiScootToken = () => process.env.MP_ACCESS_TOKEN ?? "";

/** Tudo pronto para vender? (Supabase, chave secreta do banco e conta da Hi Scoot.) */
export function storeCheckoutReady(): boolean {
  return supabaseConfigured() && Boolean(process.env.SUPABASE_SECRET_KEY && hiScootToken());
}

export type PlaceOrderResult =
  | { ok: true; id: string; token: string }
  | { ok: false; error: "unavailable" | "outOfStock" | "noShipping" | "invalid" | "paymentFailed" };

const DEMO_ID = "demo";

const dbError = (message: string): Extract<PlaceOrderResult, { ok: false }>["error"] =>
  message.includes("out_of_stock")
    ? "outOfStock"
    : message.includes("no_shipping")
      ? "noShipping"
      : message.includes("unavailable")
        ? "outOfStock"
        : "invalid";

export async function placeStoreOrder(lines: CartLine[], buyer: BuyerData, buyerId: string | null): Promise<PlaceOrderResult> {
  if (!supabaseConfigured()) return { ok: true, id: DEMO_ID, token: DEMO_ID };
  const admin = createSecretClient();
  if (!admin || !storeCheckoutReady()) return { ok: false, error: "unavailable" };

  const { data, error } = await admin.rpc("create_world_order", {
    p_items: lines.map((l) => ({ product_id: l.id, quantity: l.quantity })),
    p_buyer: buyer,
    p_buyer_id: buyerId,
  });
  const order = (data as { id: string; code: string; access_token: string; total: number | string }[] | null)?.[0];
  if (error || !order) return { ok: false, error: dbError(error?.message ?? "") };

  const [firstName, ...rest] = buyer.name.split(" ");
  const { ok, data: payment } = await createMpPayment(
    hiScootToken(),
    {
      transaction_amount: Number(order.total),
      description: `Hi Scoot · Loja · Pedido ${order.code}`,
      external_reference: `loja:${order.id}`,
      notification_url: `${await siteOrigin()}/api/mercado-pago/webhook`,
      statement_descriptor: "HISCOOT",
      payment_method_id: "pix",
      date_of_expiration: pixExpiration(),
      payer: {
        email: buyer.email,
        first_name: firstName,
        last_name: rest.join(" "),
        identification: { type: "CPF", number: buyer.cpf },
      },
    },
    `loja-${order.id}`,
  );
  const pix = payment?.point_of_interaction?.transaction_data;
  if (!ok || !payment?.id || !pix?.qr_code) {
    // Sem PIX, o pedido não vale: cancela na hora e devolve o estoque.
    await admin.from("world_orders").update({ expires_at: new Date(Date.now() - 3600_000).toISOString() }).eq("id", order.id);
    await admin.rpc("expire_world_orders");
    return { ok: false, error: "paymentFailed" };
  }
  await admin
    .from("world_orders")
    .update({
      mp_payment_id: String(payment.id),
      pix_code: pix.qr_code,
      pix_qr_base64: pix.qr_code_base64 ?? null,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", order.id);
  return { ok: true, id: order.id, token: order.access_token };
}

/** Pedido de demonstração (sem Supabase), só para conferir a tela. */
function demoOrder(): StoreOrder {
  const product = exampleWorldProducts[0];
  return {
    id: DEMO_ID,
    code: "HS0DEM0",
    status: "pending",
    status_reason: null,
    buyer_name: "Pessoa de Exemplo",
    buyer_email: "exemplo@exemplo.com",
    buyer_phone: "19999990000",
    buyer_cpf: "12345678909",
    cep: "13010000",
    street: "Rua de Exemplo",
    number: "100",
    complement: "",
    district: "Centro",
    city: "Campinas",
    state: "SP",
    subtotal: product.price,
    shipping: 15,
    total: product.price + 15,
    tracking_code: null,
    pix_code: "00020126580014br.gov.bcb.pix-EXEMPLO",
    pix_qr_base64: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    items: [{ name: product.name, price: product.price, quantity: 1 }],
  };
}

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/** Página do pedido: só com o link secreto (quem compra sem conta acompanha por ele). */
export async function getStoreOrder(id: string, token: string): Promise<StoreOrder | null> {
  if (!supabaseConfigured()) return id === DEMO_ID && token === DEMO_ID ? demoOrder() : null;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !/^[0-9a-f]{64}$/.test(token)) return null;
  const admin = createSecretClient();
  if (!admin) return null;
  const { data } = await admin.from("world_orders").select(`${ORDER_COLUMNS}, access_token, mp_payment_id`).eq("id", id).maybeSingle();
  if (!data || !sameSecret(String(data.access_token), token)) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- o segredo não vai para a tela
  const { access_token, mp_payment_id, ...row } = data as unknown as Parameters<typeof toOrder>[0] & { access_token: string; mp_payment_id: string | null };
  return toOrder(row);
}

/** A tela do PIX pergunta de tempos em tempos: já pagou? */
export async function checkStoreOrder(id: string, token: string): Promise<StoreOrder["status"] | null> {
  const order = await getStoreOrder(id, token);
  if (!order || order.status !== "pending" || !supabaseConfigured()) return order?.status ?? null;
  const admin = createSecretClient();
  const { data } = admin ? await admin.from("world_orders").select("mp_payment_id").eq("id", id).maybeSingle() : { data: null };
  if (data?.mp_payment_id) await syncStorePayment(data.mp_payment_id);
  return (await getStoreOrder(id, token))?.status ?? null;
}

/**
 * Aviso do Mercado Pago sobre um pagamento da loja: confere com o Mercado Pago
 * e, se aprovado, confirma o pedido (o banco só confirma uma vez).
 * Devolve null quando o pagamento não é da loja.
 */
export async function syncStorePayment(mpPaymentId: string): Promise<"approved" | "pending" | "rejected" | null> {
  const admin = createSecretClient();
  if (!admin || !hiScootToken()) return null;
  const { data: order } = await admin.from("world_orders").select("id").eq("mp_payment_id", mpPaymentId).maybeSingle();
  if (!order) return null;
  const { ok, data } = await getMpPayment(hiScootToken(), mpPaymentId);
  if (!ok || !data || data.external_reference !== `loja:${order.id}`) return null;
  if (data.status === "approved") {
    await admin.rpc("confirm_world_order", { p_order: order.id });
    return "approved";
  }
  return ["rejected", "cancelled", "refunded", "charged_back"].includes(data.status) ? "rejected" : "pending";
}

/** Equipe: devolve o dinheiro pelo Mercado Pago e só então registra (o estoque volta). */
export async function refundStoreOrder(id: string, reason: string): Promise<"done" | "notAllowed" | "refundFailed"> {
  const supabase = await createClient();
  const { data: order } = await supabase.from("world_orders").select("id, status, total, mp_payment_id").eq("id", id).maybeSingle();
  if (!order || order.status !== "paid" || !order.mp_payment_id || !hiScootToken()) return "notAllowed";
  const refunded = await refundMpPayment(hiScootToken(), order.mp_payment_id, Number(order.total), `loja-devolucao-${order.id}`);
  if (!refunded.ok) return "refundFailed";
  const { error } = await supabase.rpc("refund_world_order", { p_order: id, p_reason: reason });
  return error ? "notAllowed" : "done";
}
