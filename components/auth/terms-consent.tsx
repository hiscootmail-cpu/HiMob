"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LegalText } from "@/components/legal-text";
import { LEGAL_IS_DRAFT, legalDocument, type LegalDoc } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Link que abre o texto do documento numa janela, sem sair do cadastro. */
function LegalDialog({ doc, children }: { doc: LegalDoc; children: ReactNode }) {
  const t = useTranslations("legal");
  const text = legalDocument(doc, useLocale());

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="cursor-pointer font-semibold text-on-blue underline underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
        >
          {children}
        </button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")}>
        <DialogTitle>{text.title}</DialogTitle>
        <DialogDescription>{LEGAL_IS_DRAFT ? t("draftNotice") : text.updated}</DialogDescription>
        <div className="max-h-[55vh] overflow-y-auto rounded-md bg-surface p-4">
          <LegalText doc={text} compact />
        </div>
        <DialogClose asChild>
          <Button variant="outline" className="self-end">
            {t("close")}
          </Button>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

/** Caixinha "Li e aceito os Termos de Uso e a Política de Privacidade". */
export function TermsConsent({
  error,
  onChange,
}: {
  error?: string;
  onChange?: (checked: boolean) => void;
}) {
  const t = useTranslations("auth.signUp");

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-start gap-3 text-sm text-hs-black">
        <input
          type="checkbox"
          name="terms"
          aria-invalid={error ? true : undefined}
          onChange={(event) => onChange?.(event.currentTarget.checked)}
          className={cn(
            "mt-0.5 size-5 shrink-0 cursor-pointer rounded-sm accent-hs-green outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
            error && "outline-2 outline-error-line",
          )}
        />
        <span className="text-hs-black">
          {t.rich("terms", {
            terms: (chunks) => <LegalDialog doc="terms">{chunks}</LegalDialog>,
            privacy: (chunks) => <LegalDialog doc="privacy">{chunks}</LegalDialog>,
          })}
        </span>
      </label>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
