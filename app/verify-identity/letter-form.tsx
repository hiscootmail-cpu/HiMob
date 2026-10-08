"use client";

import { startTransition, useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/ui/document-upload";
import { DOCUMENT_ACCEPT, DOCUMENT_MAX_MB, validateDocument, type FieldErrorKey } from "@/lib/validation";
import { submitSocialNameLetter, type LetterState } from "./actions";

const initialState: LetterState = {};

/**
 * Pedido de revisão para pessoa trans com documento ainda não retificado:
 * foto de uma carta escrita à mão com nome social e CPF.
 */
export function LetterForm() {
  const t = useTranslations("verifyIdentity.letter");
  const tAuth = useTranslations("auth");
  const [state, formAction, pending] = useActionState(submitSocialNameLetter, initialState);
  const [local, setLocal] = useState<{ submission: unknown; error: FieldErrorKey | null } | null>(null);

  if (state.done) {
    return (
      <div role="status" className="rounded-md border border-line bg-green-soft px-4 py-3">
        <p className="text-sm font-semibold text-on-green">{t("sentTitle")}</p>
        <p className="mt-1 text-sm text-hs-black">{t("sentDescription")}</p>
      </div>
    );
  }

  const current = local?.submission === state ? local : null;
  const errorKey = current ? (current.error ?? undefined) : state.fieldErrors?.letter;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("letter");
    const error = validateDocument(file instanceof File ? file : null);
    if (error === "documentTooLarge" || error === "documentType") {
      setLocal({ submission: state, error });
      return;
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-4 rounded-md border border-line bg-hs-white p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-hs-black">{t("title")}</h2>
        <p className="text-sm text-muted">{t("description")}</p>
      </div>
      <ul className="list-disc pl-5 text-sm text-hs-black">
        <li className="text-hs-black">{t("item1")}</li>
        <li className="text-hs-black">{t("item2")}</li>
      </ul>
      <DocumentUpload
        name="letter"
        accept={DOCUMENT_ACCEPT}
        error={errorKey ? tAuth(`errors.${errorKey}`, { min: 0, max: DOCUMENT_MAX_MB }) : undefined}
        onFileChange={(file) => setLocal({ submission: state, error: file ? validateDocument(file) : null })}
        labels={{
          label: t("fileLabel"),
          choose: t("choose"),
          limits: tAuth("document.limits", { max: DOCUMENT_MAX_MB }),
          change: t("change"),
          remove: t("remove"),
        }}
      />
      <p className="text-xs text-muted">{t("privacy")}</p>
      <Button type="submit" variant="secondary" loading={pending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
