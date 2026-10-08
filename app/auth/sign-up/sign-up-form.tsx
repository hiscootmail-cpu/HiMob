"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { signUp, type AuthFormState } from "@/app/auth/actions";
import { TermsConsent } from "@/components/auth/terms-consent";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/ui/document-upload";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import {
  DOCUMENT_ACCEPT,
  DOCUMENT_MAX_MB,
  NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateDocument,
  validateEmail,
  validateFullName,
  validateNewPassword,
  type FieldErrorKey,
} from "@/lib/validation";

const initialState: AuthFormState = {};

/** Checagem local do documento e da caixinha, que não têm "sair do campo". */
type LocalChecks = { submission: unknown; document?: FieldErrorKey | null; terms?: FieldErrorKey | null };

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const fullName = useFieldValidation(validateFullName, state.fieldErrors?.fullName, state);
  const email = useFieldValidation(validateEmail, state.fieldErrors?.email, state);
  const password = useFieldValidation(validateNewPassword, state.fieldErrors?.password, state);
  const [checks, setChecks] = useState<LocalChecks>({ submission: state });

  const current = checks.submission === state ? checks : { submission: state };
  const documentError =
    current.document === undefined ? state.fieldErrors?.document : (current.document ?? undefined);
  const termsError = current.terms === undefined ? state.fieldErrors?.terms : (current.terms ?? undefined);

  const errorText = (key: FieldErrorKey | undefined) =>
    key ? t(`errors.${key}`, { min: key === "nameTooShort" ? NAME_MIN_LENGTH : PASSWORD_MIN_LENGTH, max: DOCUMENT_MAX_MB }) : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Envio manual (sem limpar o formulário depois), para a pessoa não perder
    // o documento escolhido nem o que digitou se algum campo tiver erro.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const file = formData.get("document");
    const docError = validateDocument(file instanceof File ? file : null);
    // Não envia arquivo grande demais: avisa antes, aqui mesmo.
    if (docError === "documentTooLarge" || docError === "documentType") {
      setChecks({ ...current, document: docError });
      return;
    }
    startTransition(() => formAction(formData));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <TextField
        name="fullName"
        autoComplete="name"
        label={t("fields.fullName")}
        placeholder={t("fields.fullNamePlaceholder")}
        error={errorText(fullName.error)}
        onBlur={fullName.onBlur}
        onChange={fullName.onChange}
      />

      <TextField
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={t("fields.email")}
        placeholder={t("fields.emailPlaceholder")}
        hint={t("signUp.emailHint")}
        error={errorText(email.error)}
        onBlur={email.onBlur}
        onChange={email.onChange}
      />

      <PasswordField
        name="password"
        autoComplete="new-password"
        label={t("fields.password")}
        hint={t("fields.passwordRule", { min: PASSWORD_MIN_LENGTH })}
        showLabel={t("fields.showPassword")}
        hideLabel={t("fields.hidePassword")}
        capsLockWarning={t("fields.capsLock")}
        error={errorText(password.error)}
        onBlur={password.onBlur}
        onChange={password.onChange}
      />

      <DocumentUpload
        name="document"
        accept={DOCUMENT_ACCEPT}
        error={errorText(documentError)}
        onFileChange={(file) => setChecks({ ...current, document: file ? validateDocument(file) : null })}
        labels={{
          label: t("document.label"),
          choose: t("document.choose"),
          limits: t("document.limits", { max: DOCUMENT_MAX_MB }),
          change: t("document.change"),
          remove: t("document.remove"),
          tipsTitle: t("document.tipsTitle"),
          tips: [t("document.tip1"), t("document.tip2"), t("document.tip3")],
        }}
      />

      <TermsConsent error={errorText(termsError)} onChange={(checked) => setChecks({ ...current, terms: checked ? null : "termsRequired" })} />

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t("signUp.submit")}
      </Button>

      <p className="text-center text-sm text-muted">
        {t("signUp.haveAccount")}{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-on-blue underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
        >
          {t("signUp.loginLink")}
        </Link>
      </p>
    </form>
  );
}
