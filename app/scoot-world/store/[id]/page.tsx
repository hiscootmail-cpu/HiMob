import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { AddToCart } from "@/components/scoot-world/add-to-cart";
import { ProductPhoto } from "@/components/scoot-world/product-photo";
import { getWorldProduct } from "@/lib/scoot-world";

export async function generateMetadata({ params }: PageProps<"/scoot-world/store/[id]">): Promise<Metadata> {
  const product = await getWorldProduct((await params).id);
  if (!product?.active) return {};
  return {
    title: product.name,
    description: product.description.slice(0, 160) || undefined,
    openGraph: product.photo ? { images: [{ url: product.photo }] } : undefined,
  };
}

/** Produto da loja interna: quantidade, "Pôr no carrinho" ou "Esgotado". */
export default async function WorldProductPage({ params }: PageProps<"/scoot-world/store/[id]">) {
  const product = await getWorldProduct((await params).id);
  if (!product?.active) notFound();
  const t = await getTranslations("scootWorld");
  const format = await getFormatter();

  return (
    <div className="flex flex-col gap-6">
      <BackLink href="/scoot-world/store" label={t("store.back")} />
      <div className="grid gap-6 md:grid-cols-2 md:gap-10">
        <ProductPhoto src={product.photo} alt={product.name} className="aspect-square w-full rounded-lg" />
        <div className="flex flex-col gap-4">
          <p className="text-sm font-semibold text-muted">{t("store.title")}</p>
          <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{product.name}</h1>
          <p className="text-3xl font-bold text-hs-black">{format.number(product.price, { style: "currency", currency: "BRL" })}</p>
          {product.description ? <p className="whitespace-pre-line text-base text-hs-black">{product.description}</p> : null}
          <AddToCart productId={product.id} stock={product.stock} sizes={product.sizes} />
          <p className="text-sm text-muted">{t("store.pixOnly")}</p>
        </div>
      </div>
    </div>
  );
}
