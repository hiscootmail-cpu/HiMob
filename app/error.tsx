"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Estado "com erro" de qualquer tela: algo falhou ao carregar. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errorPage");

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-hs-black">{t("title")}</h1>
      <p className="text-base text-muted">{t("description")}</p>
      <Button onClick={reset}>{t("retry")}</Button>
    </section>
  );
}
