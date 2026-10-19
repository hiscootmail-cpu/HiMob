"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, ShoppingBag, ShoppingCart, Store, Tv } from "lucide-react";
import { useTranslations } from "next-intl";

import { isActive } from "@/components/navigation";
import { useCart } from "@/components/scoot-world/cart-store";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/scoot-world", label: "home", icon: Globe },
  { href: "/scoot-world/store", label: "store", icon: ShoppingBag },
  { href: "/scoot-world/hitv", label: "tv", icon: Tv },
  { href: "/scoot-world/places", label: "places", icon: Store },
] as const;

/** Subpáginas do Mundo Scoot: início, Loja interna, HiTV, Lojas e oficinas. */
export function WorldTabs() {
  const t = useTranslations("scootWorld.tabs");
  const pathname = usePathname();
  const { count } = useCart();
  const cartActive = isActive(pathname, "/scoot-world/cart");

  return (
    <nav aria-label={t("label")} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/scoot-world" ? pathname === href : isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
                  active ? "border-hs-black bg-hs-black text-hs-white" : "border-line bg-hs-white text-hs-black hover:bg-surface",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t(label)}
              </Link>
            </li>
          );
        })}
        <li>
          <Link
            href="/scoot-world/cart"
            aria-current={cartActive ? "page" : undefined}
            aria-label={count ? t("cartCount", { count }) : t("cart")}
            className={cn(
              "inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
              cartActive ? "border-hs-black bg-hs-black text-hs-white" : "border-line bg-hs-white text-hs-black hover:bg-surface",
            )}
          >
            <ShoppingCart className="size-4" aria-hidden />
            {t("cart")}
            {count ? (
              <span
                aria-hidden
                className={cn(
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs",
                  cartActive ? "bg-hs-white text-hs-black" : "bg-hs-green text-on-green",
                )}
              >
                {count}
              </span>
            ) : null}
          </Link>
        </li>
      </ul>
    </nav>
  );
}
