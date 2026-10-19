import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { CartCheckout } from "@/app/scoot-world/cart/cart-checkout";
import { WorldHeading } from "@/components/scoot-world/world-heading";
import { getCurrentUser } from "@/lib/session";
import { storeCheckoutReady } from "@/lib/store-orders";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scootWorld.cart");
  return { title: t("title"), robots: { index: false } };
}

/** Carrinho e fechamento do pedido: qualquer pessoa compra, com ou sem conta, e paga por PIX. */
export default async function CartPage() {
  const t = await getTranslations("scootWorld.cart");
  const user = await getCurrentUser();
  // Quem tem conta já chega com nome e telefone preenchidos.
  const prefill = user ? { name: user.full_name, email: user.email, phone: user.phone } : {};

  return (
    <div className="flex flex-col gap-6">
      <WorldHeading title={t("title")} subtitle={t("subtitle")} />
      <CartCheckout ready={!supabaseConfigured() || storeCheckoutReady()} prefill={prefill} />
    </div>
  );
}
