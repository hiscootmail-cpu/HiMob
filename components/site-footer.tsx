import Link from "next/link";
import { useTranslations } from "next-intl";

import { LogoFull } from "@/components/logo";
import { cn } from "@/lib/utils";

/* Rodapé: slogan, Termos de Uso, Política de Privacidade e direitos. */
export function SiteFooter({ className }: { className?: string }) {
  const t = useTranslations("footer");

  return (
    <footer className={cn("w-full border-t border-line bg-surface text-hs-black", className)}>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-4">
          <LogoFull className="h-24" />
          <p className="text-sm text-muted">{t("slogan")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <nav aria-label={t("legalLabel")} className="flex gap-4 text-sm">
            <Link href="/terms" className="font-medium text-hs-black underline-offset-4 hover:underline">
              {t("terms")}
            </Link>
            <Link href="/privacy" className="font-medium text-hs-black underline-offset-4 hover:underline">
              {t("privacy")}
            </Link>
          </nav>
          <p className="text-sm text-muted">{t("rights", { year: new Date().getFullYear() })}</p>
        </div>
      </div>
    </footer>
  );
}
