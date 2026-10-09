import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "./update-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.updatePassword");
  return { title: t("title") };
}

export default async function UpdatePasswordPage() {
  const t = await getTranslations("auth.updatePassword");

  return (
    <AuthCard title={t("title")} description={t("description")}>
      <UpdatePasswordForm />
    </AuthCard>
  );
}
