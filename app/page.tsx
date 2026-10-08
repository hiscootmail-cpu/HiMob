import Link from "next/link";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/* PROVISÓRIO: a Home de verdade (busca + mapa) é construída no Lote 3. */
export default function HomePage() {
  const t = useTranslations("home");

  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center gap-6 px-4 py-20 text-center">
      <h1 className="text-3xl font-bold text-hs-black sm:text-4xl">{t("title")}</h1>
      <p className="text-lg text-muted">{t("description")}</p>
      <Button asChild variant="outline">
        <Link href="/design-system">{t("designSystemLink")}</Link>
      </Button>
    </section>
  );
}
