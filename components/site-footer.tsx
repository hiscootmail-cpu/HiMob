import { useTranslations } from "next-intl";

import { LogoFull } from "@/components/logo";
import { cn } from "@/lib/utils";

/*
 * Rodapé.
 * Os links de Termos de Uso e Política de Privacidade entram quando
 * esses textos e endereços forem definidos.
 */
export function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations("footer");

  return (
    <footer className={cn("w-full border-t border-line bg-surface text-hs-black", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <LogoFull className="h-24" />
          <p className="text-sm text-muted">{t("slogan")}</p>
        </div>
        <p className="text-sm text-muted">{t("rights", { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
