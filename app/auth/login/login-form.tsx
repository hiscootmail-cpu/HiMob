"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { signIn, type AuthFormState } from "@/app/auth/actions";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { TextField } from "@/components/ui/text-field";
import { validateEmail, validatePasswordPresent } from "@/lib/validation";

const initialState: AuthFormState = {};

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(signIn, initialState);
  const email = useFieldValidation(validateEmail, state.fieldErrors?.email, state);
  // Campo controlado: o e-mail continua preenchido depois de um envio com erro.
  const [emailValue, setEmailValue] = useState("");
  const password = useFieldValidation(validatePasswordPresent, state.fieldErrors?.password, state);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      {state.error ? (
        <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}

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

      <div className="flex flex-col gap-2">
        <PasswordField
          name="password"
          autoComplete="current-password"
          label={t("fields.password")}
          showLabel={t("fields.showPassword")}
          hideLabel={t("fields.hidePassword")}
          capsLockWarning={t("fields.capsLock")}
          error={password.error ? t(`errors.${password.error}`) : undefined}
          onBlur={password.onBlur}
          onChange={password.onChange}
        />
        <Link
          href="/auth/forgot-password"
          className="self-end text-sm font-medium text-on-blue underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
        >
          {t("login.forgotPassword")}
        </Link>
      </div>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t("login.submit")}
      </Button>

      <p className="text-center text-sm text-muted">
        {t("login.noAccount")}{" "}
        <Link
          href="/auth/sign-up"
          className="font-semibold text-on-blue underline-offset-4 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
        >
          {t("login.signUpLink")}
        </Link>
      </p>
    </form>
  );
}
