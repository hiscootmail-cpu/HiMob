import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Página não encontrada (endereço errado ou anúncio que não existe mais). */
export default function NotFound() {
  const t = useTranslations("notFound");

  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-hs-black">{t("title")}</h1>
      <p className="text-base text-muted">{t("description")}</p>
      <Button asChild>
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </section>
  );
}
