import { supabaseConfigured } from "@/lib/supabase/config";

/*
 * Mercado Pago (decisões de 19/10/2026).
 * Dados PÚBLICOS da aplicação "HiScoot" no Mercado Pago. Vêm das configurações
 * da hospedagem (Vercel); as chaves secretas ficam só no servidor
 * (lib/mercadopago/server.ts) e nunca entram no Git.
 */

/** Número da aplicação (aparece no link de autorização, é público). */
export const MP_CLIENT_ID = process.env.NEXT_PUBLIC_MP_CLIENT_ID ?? "";
/** Chave pública da conta Hi Scoot: usada pelo formulário seguro de pagamento. */
export const MP_PUBLIC_KEY = process.env.NEXT_PUBLIC_MP_PUBLIC_KEY ?? "";

/** O site tem os dados do Mercado Pago? (sem eles, segue o pagamento de teste) */
export function mercadoPagoConfigured(): boolean {
  return supabaseConfigured() && Boolean(MP_CLIENT_ID && MP_PUBLIC_KEY);
}
