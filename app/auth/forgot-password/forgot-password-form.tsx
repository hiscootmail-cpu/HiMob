"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { requestPasswordReset, type AuthFormState } from "@/app/auth/actions";
import { AuthCard } from "@/components/auth/auth-card";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { CheckCircleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { validateEmail } from "@/lib/validation";

const initialState: AuthFormState = {};

function BackToLogin({ label }: { label: string }) {
  return (
    <Link
      href="/auth/login"
      className="self-center text-sm font-semibold text-on-blue underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
    >
      {label}
    </Link>
  );
}

/** Depois de enviar, o cartão inteiro é trocado pela mensagem de confirmação. */
export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);
  const email = useFieldValidation(validateEmail, state.fieldErrors?.email, state);
  // Campo controlado: o e-mail continua preenchido depois de um envio com erro.
  const [emailValue, setEmailValue] = useState("");

  if (state.done) {
    return (
      <AuthCard
        title={t("forgotPassword.sentTitle")}
        description={t("forgotPassword.sentDescription", { email: state.values?.email ?? "" })}
        icon={<CheckCircleIcon className="size-12 text-on-green" />}
      >
        <p className="text-sm text-muted">{t("forgotPassword.sentHint")}</p>
        <BackToLogin label={t("forgotPassword.backToLogin")} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("forgotPassword.title")} description={t("forgotPassword.description")}>
      <form action={formAction} noValidate className="flex flex-col gap-5">
        <TextField
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          label={t("fields.email")}
          placeholder={t("fields.emailPlaceholder")}
          value={emailValue}
          error={email.error ? t(`errors.${email.error}`) : undefined}
          onBlur={email.onBlur}
          onChange={(event) => {
            setEmailValue(event.currentTarget.value);
            email.onChange(event);
          }}
        />
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {t("forgotPassword.submit")}
        </Button>
        <BackToLogin label={t("forgotPassword.backToLogin")} />
      </form>
    </AuthCard>
  );
}
