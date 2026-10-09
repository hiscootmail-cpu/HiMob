"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { isActive, navItems } from "@/components/navigation";
import { cn } from "@/lib/utils";

type BottomNavProps = {
  /** Na página de conferência a barra aparece no meio da página, não presa embaixo. */
  fixed?: boolean;
  className?: string;
};

/** Barra de navegação inferior, só no celular e só para quem está conectado. */
export function BottomNav({ fixed = true, className }: BottomNavProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("mainMenu")}
      className={cn(
        "z-40 w-full border-t border-line bg-hs-white text-hs-black md:hidden",
        fixed && "fixed inset-x-0 bottom-0 pb-[env(safe-area-inset-bottom)]",
        className,
      )}
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none outline-none focus-visible:bg-surface",
                  active ? "font-semibold text-hs-black" : "font-medium text-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-0 h-1 w-8 rounded-b-full",
                    active ? "bg-hs-green" : "bg-transparent",
                  )}
                />
                <Icon className="size-6" />
                <span className={active ? "text-hs-black" : "text-muted"}>{t(`${label}Short`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
