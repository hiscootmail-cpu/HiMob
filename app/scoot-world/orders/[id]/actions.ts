"use server";

import { checkStoreOrder } from "@/lib/store-orders";

/** A tela do PIX pergunta de tempos em tempos se o pagamento já caiu. */
export async function checkOrder(id: string, token: string) {
  return checkStoreOrder(id, token);
}
