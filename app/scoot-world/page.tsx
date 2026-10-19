import type { Metadata } from "next";
import Link from "next/link";
import { Globe, ShoppingBag, Store, Tv } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scootWorld");
  return { title: t("title"), description: t("subtitle") };
}

/** Início do Mundo Scoot: leva para a Loja interna, a HiTV e as lojas e oficinas. */
export default async function ScootWorldPage() {
  const t = await getTranslations("scootWorld");

  const areas = [
    { href: "/scoot-world/store", title: t("store.title"), text: t("store.subtitle"), icon: ShoppingBag, tone: "bg-purple-soft text-on-purple" },
    { href: "/scoot-world/hitv", title: t("tv.title"), text: t("tv.subtitle"), icon: Tv, tone: "bg-pink-soft text-on-pink" },
    { href: "/scoot-world/places", title: t("places.title"), text: t("places.subtitle"), icon: Store, tone: "bg-blue-soft text-on-blue" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 rounded-lg bg-hs-black px-6 py-8 text-hs-white sm:px-10 sm:py-12">
        <span className="flex size-14 items-center justify-center rounded-full bg-hs-green text-on-green">
          <Globe className="size-8" />
        </span>
        <h1 className="text-3xl font-bold text-hs-white sm:text-4xl">{t("title")}</h1>
        <p className="max-w-2xl text-base text-hs-white/80 sm:text-lg">{t("subtitle")}</p>
      </header>
      <ul className="grid gap-4 md:grid-cols-3">
        {areas.map(({ href, title, text, icon: Icon, tone }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col gap-3 rounded-lg border border-line bg-hs-white p-6 outline-none hover:shadow-md focus-visible:ring-4 focus-visible:ring-hs-blue/40"
            >
              <span className={`flex size-12 items-center justify-center rounded-full ${tone}`}>
                <Icon className="size-6" />
              </span>
              <span className="text-lg font-bold text-hs-black group-hover:underline">{title}</span>
              <span className="text-sm text-muted">{text}</span>
              <span className="mt-auto text-sm font-semibold text-on-blue">{t("open")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
