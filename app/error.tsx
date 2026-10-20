"use client";

import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/**
 * Estado "com erro" de qualquer tela: algo falhou ao carregar. "Tentar de novo"
 * recarrega a página inteira: se o erro veio de uma versão nova do site, a
 * página já volta certa (sem precisar sair e entrar).
 */
export default function ErrorPage() {
  const t = useTranslations("errorPage");

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-hs-black">{t("title")}</h1>
      <p className="text-base text-muted">{t("description")}</p>
      <Button onClick={() => window.location.reload()}>{t("retry")}</Button>
    </section>
  );
}
