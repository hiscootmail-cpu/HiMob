"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { signUp, type AuthFormState } from "@/app/auth/actions";
import { TermsConsent } from "@/components/auth/terms-consent";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import {
  NAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateFullName,
  validateNewPassword,
  validatePhone,
  type FieldErrorKey,
} from "@/lib/validation";

const initialState: AuthFormState = {};

/** Checagem local da caixinha dos Termos, que não tem "sair do campo". */
type LocalChecks = {
  submission: unknown;
  terms?: FieldErrorKey | null;
};

/*
 * Cadastro só com os dados básicos. O documento é pedido depois, na hora de
 * alugar ou de anunciar (decisão de 20/10/2026).
 */

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const fullName = useFieldValidation(validateFullName, state.fieldErrors?.fullName, state);
  const email = useFieldValidation(validateEmail, state.fieldErrors?.email, state);
  const phone = useFieldValidation(validatePhone, state.fieldErrors?.phone, state);
  const password = useFieldValidation(validateNewPassword, state.fieldErrors?.password, state);
  const [checks, setChecks] = useState<LocalChecks>({ submission: state });
  const router = useRouter();
  // Conta já ativa (confirmação de e-mail desligada): entra direto no painel.
  useEffect(() => {
    if (state.signedIn) router.push("/dashboard?welcome=1");
  }, [state.signedIn, router]);

  const current = checks.submission === state ? checks : { submission: state };
  const termsError = current.terms === undefined ? state.fieldErrors?.terms : (current.terms ?? undefined);

  const errorText = (key: FieldErrorKey | undefined) =>
    key ? t(`errors.${key}`, { min: key === "nameTooShort" ? NAME_MIN_LENGTH : PASSWORD_MIN_LENGTH }) : undefined;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Envio manual (sem limpar o formulário depois), para a pessoa não perder
    // o que digitou se algum campo tiver erro.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
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

      <TextField
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        label={t("fields.phone")}
        placeholder="(11) 91234-5678"
        hint={t("fields.phoneHint")}
        error={errorText(phone.error)}
        onBlur={phone.onBlur}
        onChange={phone.onChange}
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

      <TermsConsent error={errorText(termsError)} onChange={(checked) => setChecks({ ...current, terms: checked ? null : "termsRequired" })} />

      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending || Boolean(state.signedIn)} className="w-full">
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
