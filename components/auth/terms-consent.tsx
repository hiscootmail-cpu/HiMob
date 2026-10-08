"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type LegalDoc = "terms" | "privacy";

/** Link que abre o texto do documento numa janela, sem sair do cadastro. */
function LegalDialog({ doc, children }: { doc: LegalDoc; children: ReactNode }) {
  const t = useTranslations("legal");

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
        <DialogTitle>{t(`${doc}.title`)}</DialogTitle>
        <DialogDescription>{t("pendingNotice")}</DialogDescription>
        {/* O texto oficial entra aqui quando estiver pronto. */}
        <div className="overflow-y-auto rounded-md bg-surface p-4 text-sm text-hs-black">
          {t(`${doc}.placeholder`)}
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
