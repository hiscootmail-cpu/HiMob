"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { useTranslations } from "next-intl";

import { CalendarIcon, KeyIcon, WalletIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/** Abas da área do Host: Visão geral, Meus anúncios, Reservas recebidas e Ganhos. */
export function HostTabs() {
  const t = useTranslations("host.tabs");
  const pathname = usePathname();
  const tabs = [
    { href: "/host", label: t("overview"), icon: LayoutGrid },
    { href: "/host/equipment", label: t("listings"), icon: KeyIcon },
    { href: "/host/reservations", label: t("reservations"), icon: CalendarIcon },
    { href: "/host/earnings", label: t("earnings"), icon: WalletIcon },
  ];

  return (
    <nav aria-label={t("label")} className="border-b border-line">
      <ul className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = href === "/host" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
                  active ? "border-hs-black text-hs-black" : "border-transparent text-muted hover:text-hs-black",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
