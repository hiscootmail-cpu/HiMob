"use client";

import { useId } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";

import { DocumentUpload } from "@/components/ui/document-upload";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_MB } from "@/lib/validation";

export type DocumentSide = "front" | "back";

type IdentityDocumentFieldsProps = {
  errors: Partial<Record<DocumentSide, string>>;
  onFileChange: (side: DocumentSide, file: File | null) => void;
};

/** Frente e verso do documento com foto, com a explicação e as dicas de foto. */
export function IdentityDocumentFields({ errors, onFileChange }: IdentityDocumentFieldsProps) {
  const t = useTranslations("auth.document");
  const descriptionId = useId();
  const tipsId = useId();
  const socialNameId = useId();

  const common = {
    accept: DOCUMENT_ACCEPT,
    describedBy: `${descriptionId} ${socialNameId} ${tipsId}`,
  };
  const labels = (side: DocumentSide) => ({
    label: t(`${side}.label`),
    choose: t(`${side}.choose`),
    limits: t("limits", { max: DOCUMENT_MAX_MB }),
    change: t(`${side}.change`),
    remove: t(`${side}.remove`),
  });

  return (
    <fieldset className="flex min-w-0 flex-col gap-3">
      <legend className="text-sm font-medium text-hs-black">{t("label")}</legend>
      <p id={descriptionId} className="-mt-1 text-sm text-muted">
        {t("purpose")}
      </p>

      {/* Aviso para todos, na hora de enviar (aprovado em 08/10/2026). */}
      <div id={socialNameId} className="flex gap-2 rounded-md border border-hs-blue/40 bg-blue-soft px-3 py-2">
        <Info className="mt-0.5 size-4 shrink-0 text-on-blue" aria-hidden />
        <p className="text-sm text-on-blue">
          <span className="font-semibold text-on-blue">{t("socialName.title")}</span> {t("socialName.text")}
        </p>
      </div>

      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        <DocumentUpload
          name="documentFront"
          labels={labels("front")}
          error={errors.front}
          onFileChange={(file) => onFileChange("front", file)}
          {...common}
        />
        <DocumentUpload
          name="documentBack"
          labels={labels("back")}
          error={errors.back}
          onFileChange={(file) => onFileChange("back", file)}
          {...common}
        />
      </div>

      <div id={tipsId} className="rounded-md bg-surface px-3 py-2">
        <p className="text-xs font-semibold text-hs-black">{t("tipsTitle")}</p>
        <ul className="mt-1 list-disc pl-4 text-xs text-muted">
          <li className="text-muted">{t("tip1")}</li>
          <li className="text-muted">{t("tip2")}</li>
          <li className="text-muted">{t("tip3")}</li>
        </ul>
      </div>
    </fieldset>
  );
}
