import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LegalText } from "@/components/legal-text";
import { LEGAL_IS_DRAFT, legalDocument } from "@/lib/legal";

export async function generateMetadata(): Promise<Metadata> {
  return { title: legalDocument("privacy", await getLocale()).title };
}

/** Política de Privacidade (rascunho de 19/10/2026, em revisão jurídica). */
export default async function PrivacyPage() {
  const doc = legalDocument("privacy", await getLocale());
  const t = await getTranslations("legal");

  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{doc.title}</h1>
        <p className="text-sm text-muted">{doc.updated}</p>
      </header>
      {LEGAL_IS_DRAFT ? (
        <p role="note" className="rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">
          {t("draftNotice")}
        </p>
      ) : null}
      <LegalText doc={doc} />
    </article>
  );
}
