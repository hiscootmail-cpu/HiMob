import "server-only";

import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { MP_CLIENT_ID, mercadoPagoConfigured } from "@/lib/mercadopago/config";
import { createClient, createSecretClient } from "@/lib/supabase/server";

/*
 * Conversa com o Mercado Pago, SÓ no servidor.
 * Chaves secretas (configurações da Vercel, nunca no Git):
 * - MP_CLIENT_SECRET: senha da aplicação "HiScoot" (troca o código do OAuth pelas chaves da conta).
 * - MP_WEBHOOK_SECRET: assinatura dos avisos que o Mercado Pago manda para o site.
 * - MP_TEST_MODE = "true": usa as contas e cartões de teste.
 * - SUPABASE_SECRET_KEY: guardar e ler as chaves das contas conectadas.
 */

const API = "https://api.mercadopago.com";
const AUTH = "https://auth.mercadopago.com.br/authorization";

const clientSecret = () => process.env.MP_CLIENT_SECRET ?? "";
const testMode = () => process.env.MP_TEST_MODE === "true";

/** Tudo pronto para conectar contas e cobrar? */
export function mercadoPagoServerReady(): boolean {
  return mercadoPagoConfigured() && Boolean(clientSecret() && process.env.SUPABASE_SECRET_KEY);
}

/** O Mercado Pago está ligado no banco (app_settings)? Antes disso, vale o pagamento de teste. */
export async function mercadoPagoOn(): Promise<boolean> {
  if (!mercadoPagoConfigured()) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("mp_required");
  return data === true;
}

/** A pessoa conectada já ligou a conta Mercado Pago? */
export async function mercadoPagoConnected(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("mp_connected");
  return data === true;
}

// -----------------------------------------------------------------------------
// OAuth com PKCE: a pessoa autoriza a Hi Scoot na conta Mercado Pago dela
// -----------------------------------------------------------------------------

/** Cookie com o segredo de uma tentativa de conexão (vale 10 minutos, só o servidor lê). */
export const MP_OAUTH_COOKIE = "hs_mp_oauth";

const base64url = (buffer: Buffer) => buffer.toString("base64url");

export function newPkce() {
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const state = base64url(randomBytes(24));
  return { verifier, challenge, state };
}

export const redirectUri = (origin: string) => `${origin}/mercado-pago/callback`;

export function authorizationUrl(origin: string, state: string, challenge: string) {
  const query = new URLSearchParams({
    client_id: MP_CLIENT_ID,
    response_type: "code",
    platform_id: "mp",
    state,
    redirect_uri: redirectUri(origin),
    code_challenge: challenge,
    code_challenge_method: "S256",
    code_method: "S256",
  });
  return `${AUTH}?${query}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  public_key?: string;
  user_id: number | string;
  expires_in: number;
  live_mode?: boolean;
};

async function tokenRequest(body: Record<string, string | boolean>): Promise<TokenResponse | null> {
  const response = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: MP_CLIENT_ID, client_secret: clientSecret(), ...body, ...(testMode() ? { test_token: true } : {}) }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  return (await response.json()) as TokenResponse;
}

/** Troca o código da volta do OAuth pelas chaves da conta e guarda (só o servidor lê). */
export async function connectAccount(userId: string, code: string, verifier: string, origin: string): Promise<boolean> {
  const admin = createSecretClient();
  if (!admin) return false;
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(origin),
    code_verifier: verifier,
  });
  if (!token?.access_token) return false;
  const { error } = await admin.from("mp_accounts").upsert({
    user_id: userId,
    mp_user_id: String(token.user_id),
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    public_key: token.public_key ?? null,
    expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
    live_mode: Boolean(token.live_mode),
    updated_at: new Date().toISOString(),
  });
  return !error;
}

/** Chave da conta Mercado Pago de uma pessoa (renova sozinha perto de vencer). */
export async function accessTokenFor(userId: string): Promise<string | null> {
  const admin = createSecretClient();
  if (!admin) return null;
  const { data } = await admin
    .from("mp_accounts")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  // Renova com 15 dias de folga (as chaves valem 180 dias).
  if (new Date(data.expires_at).getTime() - Date.now() > 15 * 24 * 3600 * 1000) return data.access_token;
  const token = await tokenRequest({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  if (!token?.access_token) return data.access_token;
  await admin
    .from("mp_accounts")
    .update({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(Date.now() + token.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  return token.access_token;
}

// -----------------------------------------------------------------------------
// Pagamentos (API de Pagamentos, Checkout Transparente)
// -----------------------------------------------------------------------------

export type MpPayment = {
  id: number | string;
  status: string;
  status_detail?: string;
  external_reference?: string;
  point_of_interaction?: { transaction_data?: { qr_code?: string; qr_code_base64?: string } };
};

async function mpFetch<T>(path: string, accessToken: string, init: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "X-Idempotency-Key": init.idempotencyKey } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as T | null;
  return { ok: response.ok, data };
}

/** Cria o pagamento na conta do Host, com a parte da Hi Scoot separada (application_fee). */
export function createMpPayment(hostAccessToken: string, body: Record<string, unknown>, idempotencyKey: string) {
  return mpFetch<MpPayment>("/v1/payments", hostAccessToken, { method: "POST", body, idempotencyKey });
}

export function getMpPayment(hostAccessToken: string, paymentId: string) {
  return mpFetch<MpPayment>(`/v1/payments/${encodeURIComponent(paymentId)}`, hostAccessToken);
}

/** Devolução (total ou parcial) de um pagamento. */
export function refundMpPayment(hostAccessToken: string, paymentId: string, amount: number, idempotencyKey: string) {
  return mpFetch<{ id: number }>(`/v1/payments/${encodeURIComponent(paymentId)}/refunds`, hostAccessToken, {
    method: "POST",
    body: { amount },
    idempotencyKey,
  });
}

// -----------------------------------------------------------------------------
// Avisos do Mercado Pago (webhook): confere a assinatura antes de acreditar
// -----------------------------------------------------------------------------

/**
 * Assinatura do aviso: cabeçalho x-signature ("ts=...,v1=...") e x-request-id.
 * Texto assinado: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" com a chave MP_WEBHOOK_SECRET.
 */
export function validWebhookSignature(signature: string | null, requestId: string | null, dataId: string): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...rest] = part.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  if (!parts.ts || !parts.v1) return false;
  const id = /^[a-z0-9]+$/i.test(dataId) ? dataId.toLowerCase() : dataId;
  let manifest = `id:${id};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${parts.ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(parts.v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Atualiza um pagamento com o que o Mercado Pago diz e, se aprovado, confirma
 * a reserva (o banco só confirma uma vez). Usado pelo aviso e pela tela do PIX.
 */
export async function syncPayment(mpPaymentId: string): Promise<"approved" | "pending" | "rejected" | null> {
  const admin = createSecretClient();
  if (!admin) return null;
  const { data: row } = await admin
    .from("payments")
    .select("id, status, booking_id, bookings(host_id)")
    .eq("mp_payment_id", mpPaymentId)
    .maybeSingle();
  if (!row) return null;
  const hostId = (row.bookings as unknown as { host_id: string } | null)?.host_id;
  if (!hostId) return null;
  const token = await accessTokenFor(hostId);
  if (!token) return null;
  const { ok, data } = await getMpPayment(token, mpPaymentId);
  if (!ok || !data) return null;
  if (data.external_reference && data.external_reference !== row.booking_id) return null;

  if (data.status === "approved") {
    await admin.rpc("confirm_payment", { p_payment: row.id });
    return "approved";
  }
  await admin.from("payments").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", row.id);
  return ["rejected", "cancelled", "refunded", "charged_back"].includes(data.status) ? "rejected" : "pending";
}
