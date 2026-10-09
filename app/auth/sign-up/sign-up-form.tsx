"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { finishSignupDocuments, signUp, type AuthFormState } from "@/app/auth/actions";
import { IdentityDocumentFields, type DocumentSide } from "@/components/auth/identity-document-fields";
import { TermsConsent } from "@/components/auth/terms-consent";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import {
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
type LocalChecks = {
  submission: unknown;
  front?: FieldErrorKey | null;
  back?: FieldErrorKey | null;
  terms?: FieldErrorKey | null;
};

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const fullName = useFieldValidation(validateFullName, state.fieldErrors?.fullName, state);
  const email = useFieldValidation(validateEmail, state.fieldErrors?.email, state);
  const password = useFieldValidation(validateNewPassword, state.fieldErrors?.password, state);
  const [checks, setChecks] = useState<LocalChecks>({ submission: state });
  const router = useRouter();
  // Arquivos escolhidos: com a Supabase, vão direto do navegador para a pasta privada.
  const files = useRef<{ front?: File; back?: File }>({});
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const upload = state.upload;
    const { front, back } = files.current;
    if (!upload || !front || !back) return;
    let cancelled = false;
    (async () => {
      const bucket = createClient().storage.from("identity-documents");
      const [a, b] = await Promise.all([
        bucket.uploadToSignedUrl(upload.front.path, upload.front.token, front, { contentType: front.type }),
        bucket.uploadToSignedUrl(upload.back.path, upload.back.token, back, { contentType: back.type }),
      ]);
      if (!a.error && !b.error) await finishSignupDocuments(upload.front.path, upload.back.path);
      // Mesmo se o envio falhar, a conta existe: o documento é pedido no primeiro acesso.
      if (!cancelled) router.push("/auth/sign-up-success");
    })();
    return () => {
      cancelled = true;
    };
  }, [state.upload, router]);

  const current = checks.submission === state ? checks : { submission: state };
  const pick = (local: FieldErrorKey | null | undefined, server: FieldErrorKey | undefined) =>
    local === undefined ? server : (local ?? undefined);
  const frontError = pick(current.front, state.fieldErrors?.documentFront);
  const backError = pick(current.back, state.fieldErrors?.documentBack);
  const termsError = current.terms === undefined ? state.fieldErrors?.terms : (current.terms ?? undefined);

  const errorText = (key: FieldErrorKey | undefined) =>
    key ? t(`errors.${key}`, { min: key === "nameTooShort" ? NAME_MIN_LENGTH : PASSWORD_MIN_LENGTH, max: DOCUMENT_MAX_MB }) : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Envio manual (sem limpar o formulário depois), para a pessoa não perder
    // o documento escolhido nem o que digitou se algum campo tiver erro.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Não envia arquivo grande demais ou de formato errado: avisa antes, aqui mesmo.
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
    if (supabaseConfigured()) {
      // Só os dados do arquivo vão para o servidor do site (que tem limite de tamanho).
      for (const name of ["documentFront", "documentBack"] as const) {
        const file = formData.get(name);
        if (file instanceof File && file.size > 0) {
          files.current[name === "documentFront" ? "front" : "back"] = file;
          formData.set(`${name}Meta`, JSON.stringify({ type: file.type, size: file.size }));
        }
        formData.delete(name);
      }
      setUploading(true);
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

      <IdentityDocumentFields
        errors={{ front: errorText(frontError), back: errorText(backError) }}
        onFileChange={(side: DocumentSide, file) =>
          setChecks({ ...current, [side]: file ? validateDocument(file) : null })
        }
      />

      <TermsConsent error={errorText(termsError)} onChange={(checked) => setChecks({ ...current, terms: checked ? null : "termsRequired" })} />

      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending || (uploading && Boolean(state.upload))} className="w-full">
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
