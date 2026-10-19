import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ProductPhoto } from "@/components/scoot-world/product-photo";
import { WorldHeading } from "@/components/scoot-world/world-heading";
import { listWorldProducts } from "@/lib/scoot-world";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scootWorld.store");
  return { title: t("title"), description: t("subtitle") };
}

/** Loja interna: por enquanto só vitrine (a compra pelo site ainda vai ser decidida). */
export default async function WorldStorePage() {
  const t = await getTranslations("scootWorld.store");
  const format = await getFormatter();
  // A equipe também vê os escondidos no banco; aqui só aparece o que está ativo.
  const products = (await listWorldProducts()).filter((p) => p.active);

  return (
    <div className="flex flex-col gap-6">
      <WorldHeading title={t("title")} subtitle={t("subtitle")} />
      {products.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-10 text-center text-base text-muted">{t("empty")}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <li key={product.id}>
              <Link
                href={`/scoot-world/store/${product.id}`}
                className="group flex h-full flex-col overflow-hidden rounded-lg border border-line bg-hs-white outline-none hover:shadow-md focus-visible:ring-4 focus-visible:ring-hs-blue/40"
              >
                <ProductPhoto src={product.photo} className="aspect-square w-full" />
                <span className="flex flex-1 flex-col gap-1 p-3">
                  <span className="line-clamp-2 text-sm font-semibold text-hs-black group-hover:underline">{product.name}</span>
                  <span className="text-base font-bold text-hs-black">{format.number(product.price, { style: "currency", currency: "BRL" })}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
