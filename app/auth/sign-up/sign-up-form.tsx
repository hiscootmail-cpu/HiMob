"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { signUp, type AuthFormState } from "@/app/auth/actions";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import { PASSWORD_MIN_LENGTH, validateEmail, validateNewPassword } from "@/lib/validation";

const initialState: AuthFormState = {};

export function SignUpForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signUp, initialState);
  const email = useFieldValidation(validateEmail, state.fieldErrors?.email, state);
  // Campo controlado: o e-mail continua preenchido depois de um envio com erro.
  const [emailValue, setEmailValue] = useState("");
  const password = useFieldValidation(validateNewPassword, state.fieldErrors?.password, state);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <TextField
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        label={t("fields.email")}
        placeholder={t("fields.emailPlaceholder")}
        hint={t("signUp.emailHint")}
        value={emailValue}
        error={email.error ? t(`errors.${email.error}`) : undefined}
        onBlur={email.onBlur}
        onChange={(event) => {
          setEmailValue(event.currentTarget.value);
          email.onChange(event);
        }}
      />

      <PasswordField
        name="password"
        autoComplete="new-password"
        label={t("fields.password")}
        hint={t("fields.passwordRule", { min: PASSWORD_MIN_LENGTH })}
        showLabel={t("fields.showPassword")}
        hideLabel={t("fields.hidePassword")}
        capsLockWarning={t("fields.capsLock")}
        error={password.error ? t(`errors.${password.error}`, { min: PASSWORD_MIN_LENGTH }) : undefined}
        onBlur={password.onBlur}
        onChange={password.onChange}
      />

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
