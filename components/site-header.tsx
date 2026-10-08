"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import { isActive, navItems } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SiteHeaderProps = {
  /** Pessoa conectada? Muda os botões do lado direito. */
  signedIn: boolean;
  /** Na página de conferência o menu não fica preso no topo. */
  sticky?: boolean;
  className?: string;
};

/** Menu principal com o seletor de idioma PT/EN: uma peça só. */
export function SiteHeader({ signedIn, sticky = true, className }: SiteHeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();

  return (
    <header
      className={cn(
        "z-40 w-full border-b border-line bg-hs-white/95 text-hs-black backdrop-blur",
        sticky && "sticky top-0",
        className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href="/"
          aria-label={t("home")}
          className="shrink-0 rounded-md outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
        >
          <Logo />
        </Link>

        {signedIn ? (
          <nav aria-label={t("mainMenu")} className="hidden flex-1 justify-center md:flex">
            <ul className="flex items-center gap-1">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
                        active
                          ? "bg-green-soft text-on-green"
                          : "text-hs-black hover:bg-surface",
                      )}
                    >
                      <Icon className="size-5" />
                      {t(label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : (
          <div className="flex-1" />
        )}

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <LanguageSwitcher />
          {signedIn ? null : (
            <>
              {/* No celular só cabe um botão: "Entrar", e a tela de entrada leva a "Criar conta". */}
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/login">{t("signIn")}</Link>
              </Button>
              <Button asChild size="sm" className="hidden sm:inline-flex">
                <Link href="/auth/sign-up">{t("signUp")}</Link>
              </Button>
              <Button asChild size="sm" className="sm:hidden">
                <Link href="/auth/login">{t("signIn")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
