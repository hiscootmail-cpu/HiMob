"use client";

import { startTransition, useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/auth-card";
import { IdentityDocumentFields, type DocumentSide } from "@/components/auth/identity-document-fields";
import { Button } from "@/components/ui/button";
import { DOCUMENT_MAX_MB, validateDocument, type FieldErrorKey } from "@/lib/validation";
import { resubmitDocument, type ResubmitState } from "./actions";
import { LetterForm } from "./letter-form";
import { PendingCard } from "./status-cards";

const initialState: ResubmitState = {};

type LocalChecks = { submission: unknown; front?: FieldErrorKey | null; back?: FieldErrorKey | null };

/**
 * Envio de frente e verso: primeiro envio (quando o cadastro não guardou o
 * documento) ou reenvio depois da primeira recusa.
 */
export function ResubmitForm({ reason, firstTime = false }: { reason?: string; firstTime?: boolean }) {
  const t = useTranslations("verifyIdentity");
  const tAuth = useTranslations("auth");
  const [state, formAction, pending] = useActionState(resubmitDocument, initialState);
  const [checks, setChecks] = useState<LocalChecks>({ submission: state });

  if (state.done) return <PendingCard />;

  const current = checks.submission === state ? checks : { submission: state };
  const pick = (local: FieldErrorKey | null | undefined, server: FieldErrorKey | undefined) =>
    local === undefined ? server : (local ?? undefined);
  const errorText = (key: FieldErrorKey | undefined) =>
    key ? tAuth(`errors.${key}`, { min: 0, max: DOCUMENT_MAX_MB }) : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const blocking = (name: string) => {
      const file = formData.get(name);
      const error = validateDocument(file instanceof File ? file : null);
      return error === "documentTooLarge" || error === "documentType" ? error : undefined;
    };
    const front = blocking("documentFront");
    const back = blocking("documentBack");
    if (front || back) {
      setChecks({ ...current, front: front ?? current.front, back: back ?? current.back });
      return;
    }
    startTransition(() => formAction(formData));
  }

  return (
    <AuthCard
      title={firstTime ? t("first.title") : t("rejected.title")}
      description={firstTime ? t("first.description") : t("rejected.description")}
    >
      {reason ? (
        <div className="rounded-md border border-line bg-surface px-4 py-3">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">{t("rejected.reasonLabel")}</p>
          <p className="mt-1 text-sm text-hs-black">{reason}</p>
        </div>
      ) : null}

      {firstTime ? null : (
        <p role="note" className="rounded-md border border-hs-pink/40 bg-pink-soft px-4 py-3 text-sm font-medium text-on-pink">
          {t("rejected.lastAttempt")}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        <IdentityDocumentFields
          errors={{
            front: errorText(pick(current.front, state.fieldErrors?.documentFront)),
            back: errorText(pick(current.back, state.fieldErrors?.documentBack)),
          }}
          onFileChange={(side: DocumentSide, file) =>
            setChecks({ ...current, [side]: file ? validateDocument(file) : null })
          }
        />
        {state.error ? (
          <p role="alert" className="text-sm text-error">
            {tAuth("errors.unexpected")}
          </p>
        ) : null}
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {firstTime ? t("first.submit") : t("rejected.submit")}
        </Button>
      </form>

      {/* Carta já na 1ª recusa: a pessoa trans não precisa passar pelo bloqueio (aprovado em 08/10/2026). */}
      {firstTime ? null : (
        <>
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-semibold text-muted uppercase">{t("or")}</span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <LetterForm />
        </>
      )}
    </AuthCard>
  );
}
