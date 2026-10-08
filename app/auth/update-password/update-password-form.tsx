"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { updatePassword, type AuthFormState } from "@/app/auth/actions";
import { useFieldValidation } from "@/components/auth/use-field-validation";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/password-field";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/lib/validation";

const initialState: AuthFormState = {};

export function UpdatePasswordForm() {
  const t = useTranslations("auth");
  const [state, formAction, pending] = useActionState(updatePassword, initialState);
  const password = useFieldValidation(validateNewPassword, state.fieldErrors?.password, state);

  return (
    <form action={formAction} noValidate className="flex flex-col gap-5">
      <PasswordField
        name="password"
        autoComplete="new-password"
        label={t("updatePassword.newPassword")}
        hint={t("fields.passwordRule", { min: PASSWORD_MIN_LENGTH })}
        showLabel={t("fields.showPassword")}
        hideLabel={t("fields.hidePassword")}
        capsLockWarning={t("fields.capsLock")}
        error={password.error ? t(`errors.${password.error}`, { min: PASSWORD_MIN_LENGTH }) : undefined}
        onBlur={password.onBlur}
        onChange={password.onChange}
      />
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t("updatePassword.submit")}
      </Button>
    </form>
  );
}
