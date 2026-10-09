"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";

import { updateProfile, type ProfileState } from "@/app/profile/actions";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { CITY_MAX, NAME_MIN_LENGTH } from "@/lib/validation";

type ProfileFormProps = {
  defaults: { fullName: string; phone: string; city: string };
  /** Identidade verificada: o nome fica travado. */
  nameLocked: boolean;
};

export function ProfileForm({ defaults, nameLocked }: ProfileFormProps) {
  const t = useTranslations("profileEdit");
  const tAuth = useTranslations("auth.errors");
  const [state, action, pending] = useActionState(updateProfile, {} as ProfileState);
  const values = state.values ?? defaults;

  return (
    <form action={action} noValidate className="flex flex-col gap-5 rounded-lg border border-line bg-hs-white p-5">
      {nameLocked ? (
        <div className="flex flex-col gap-1.5">
          <TextField name="fullName" label={t("nameLabel")} defaultValue={defaults.fullName} readOnly aria-readonly disabled />
          <p className="flex gap-2 text-sm text-muted">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {t.rich("nameLocked", {
                link: (chunks) => (
                  <Link href="/verify-identity" className="font-semibold text-hs-black underline underline-offset-2">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </p>
        </div>
      ) : (
        <TextField
          key={`name-${values.fullName}`}
          name="fullName"
          label={t("nameLabel")}
          autoComplete="name"
          defaultValue={values.fullName}
          error={state.errors?.fullName ? tAuth(state.errors.fullName, { min: NAME_MIN_LENGTH }) : undefined}
        />
      )}
      <TextField
        key={`phone-${values.phone}`}
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        label={t("phoneLabel")}
        placeholder="(11) 91234-5678"
        defaultValue={values.phone}
        hint={t("phoneHint")}
        error={state.errors?.phone ? t(`errors.${state.errors.phone}`) : undefined}
      />
      <TextField
        key={`city-${values.city}`}
        name="city"
        label={t("cityLabel")}
        autoComplete="address-level2"
        maxLength={CITY_MAX}
        defaultValue={values.city}
        error={state.errors?.city ? t(`errors.${state.errors.city}`, { max: CITY_MAX }) : undefined}
      />
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {tAuth("unexpected")}
        </p>
      ) : null}
      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-fit sm:self-end">
        {t("save")}
      </Button>
    </form>
  );
}
