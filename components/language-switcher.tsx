"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { setLocale } from "@/i18n/actions";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

const shortLabel: Record<Locale, string> = { pt: "PT", en: "EN" };

/** Seletor de idioma: dois botões juntos, "PT" e "EN". */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("language");
  const current = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(locale: Locale) {
    if (locale === current) return;
    startTransition(async () => {
      await setLocale(locale);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("label")}
      aria-busy={pending || undefined}
      className={cn(
        "inline-flex shrink-0 items-center rounded-full border border-line bg-surface p-0.5",
        pending && "opacity-60",
        className,
      )}
    >
      {locales.map((locale) => {
        const active = locale === current;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            onClick={() => choose(locale)}
            aria-pressed={active}
            aria-label={t(locale)}
            disabled={pending}
            className={cn(
              "h-8 min-w-10 cursor-pointer rounded-full px-3 text-xs font-bold transition-colors outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
              active
                ? "bg-hs-black text-hs-white"
                : "bg-transparent text-hs-black hover:bg-line",
            )}
          >
            {shortLabel[locale]}
          </button>
        );
      })}
    </div>
  );
}
