"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/** Sub-abas de Ganhos: Meus ganhos e Simular. */
export function EarningsTabs() {
  const t = useTranslations("host.earnings");
  const pathname = usePathname();
  const tabs = [
    { href: "/host/earnings", label: t("tabMine") },
    { href: "/host/earnings/simulate", label: t("tabSimulate") },
  ];
  return (
    <nav aria-label={t("title")} className="flex gap-2">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 items-center rounded-full border px-4 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
              active ? "border-hs-black bg-hs-black text-hs-white" : "border-hs-black/20 bg-hs-white text-hs-black hover:bg-surface",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
