"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";

import { setLocale } from "@/i18n/actions";
import { locales, type Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

/** Escolha do idioma em Configurações (a mesma escolha do seletor PT/EN do topo). */
export function LanguageChoice() {
  const t = useTranslations("settings");
  const tLang = useTranslations("language");
  const current = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-busy={pending || undefined}>
      <legend className="mb-1 text-sm text-muted">{t("languageHelp")}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {locales.map((locale) => (
          <label
            key={locale}
            lang={locale}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-hs-blue/40",
              locale === current ? "border-hs-green bg-green-soft" : "border-line bg-hs-white hover:bg-surface",
            )}
          >
            <input
              type="radio"
              name="language"
              value={locale}
              checked={locale === current}
              disabled={pending}
              onChange={() =>
                startTransition(async () => {
                  await setLocale(locale);
                  router.refresh();
                })
              }
              className="size-5 accent-hs-green"
            />
            <span className="text-base font-semibold text-hs-black">{tLang(locale)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
