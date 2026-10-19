import { NextResponse, type NextRequest } from "next/server";

import { syncPayment, validWebhookSignature } from "@/lib/mercadopago/server";

/*
 * Avisos do Mercado Pago sobre pagamentos. O site só acredita no aviso com a
 * assinatura certa e, mesmo assim, pergunta de novo ao Mercado Pago a situação
 * do pagamento antes de confirmar a reserva.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { type?: string; action?: string; data?: { id?: string | number } } | null;
  const dataId = request.nextUrl.searchParams.get("data.id") ?? String(body?.data?.id ?? "");
  const type = request.nextUrl.searchParams.get("type") ?? body?.type ?? "";
  if (!dataId) return NextResponse.json({ ok: true });

  if (!validWebhookSignature(request.headers.get("x-signature"), request.headers.get("x-request-id"), dataId)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }
  if (type === "payment") await syncPayment(dataId);
  return NextResponse.json({ ok: true });
}
