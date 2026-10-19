"use client";

import { useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { unitsOf, useCart } from "@/components/scoot-world/cart-store";
import { Button } from "@/components/ui/button";
import { WORLD_LIMITS } from "@/lib/scoot-world-rules";
import { cn } from "@/lib/utils";

/**
 * Tamanho (quando o produto tem) + quantidade + "Pôr no carrinho" na página do
 * produto. Sem estoque: "Esgotado". O estoque é um só para todos os tamanhos.
 */
export function AddToCart({ productId, stock, sizes }: { productId: string; stock: number; sizes: string[] }) {
  const t = useTranslations("scootWorld.store");
  const cart = useCart();
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState<string | null>(null);
  const [sizeMissing, setSizeMissing] = useState(false);
  const inCart = unitsOf(cart.lines, productId);
  const max = Math.min(stock, WORLD_LIMITS.perItem) - inCart;

  if (stock <= 0) {
    return <p className="rounded-md bg-surface px-4 py-3 text-base font-semibold text-hs-black">{t("soldOut")}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted">{t("inStock", { count: stock })}</p>
      {sizes.length && max > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-hs-black">{t("size")}</legend>
          <div className="flex flex-wrap gap-2">
            {sizes.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex h-11 min-w-12 cursor-pointer items-center justify-center rounded-md border px-3 text-sm font-semibold has-focus-visible:ring-4 has-focus-visible:ring-hs-blue/40",
                  size === option ? "border-hs-black bg-hs-black text-hs-white" : "border-line bg-hs-white text-hs-black hover:bg-surface",
                )}
              >
                <input
                  type="radio"
                  name={`size-${productId}`}
                  value={option}
                  checked={size === option}
                  onChange={() => {
                    setSize(option);
                    setSizeMissing(false);
                  }}
                  className="sr-only"
                />
                {option}
              </label>
            ))}
          </div>
          {sizeMissing ? (
            <p role="alert" className="text-sm text-error">
              {t("sizeRequired")}
            </p>
          ) : null}
        </fieldset>
      ) : null}
      {max > 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-full border border-line" role="group" aria-label={t("quantity")}>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity <= 1}
              aria-label={t("less")}
              className="flex size-11 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 disabled:opacity-40"
            >
              <Minus className="size-4" />
            </button>
            <span aria-live="polite" className="w-8 text-center text-base font-semibold text-hs-black">
              {Math.min(quantity, max)}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(max, q + 1))}
              disabled={quantity >= max}
              aria-label={t("more")}
              className="flex size-11 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => {
              if (sizes.length && !size) {
                setSizeMissing(true);
                return;
              }
              cart.add({ id: productId, quantity: Math.min(quantity, max), ...(size ? { size } : {}) }, stock);
              setQuantity(1);
            }}
          >
            {t("addToCart")}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-hs-black">{t("maxInCart")}</p>
      )}
      {inCart ? (
        <p role="status" className="text-sm text-hs-black">
          {t("inCart", { count: inCart })}{" "}
          <Link href="/scoot-world/cart" className="font-semibold underline underline-offset-2">
            {t("seeCart")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
