import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { CheckCircleIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUpSuccess");
  return { title: t("title") };
}

/** Só texto informativo, sem botões (conforme o inventário de ações). */
export default async function SignUpSuccessPage() {
  const t = await getTranslations("auth.signUpSuccess");

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<CheckCircleIcon className="size-12 text-on-green" />}
    >
      <p className="text-sm text-muted">{t("spamHint")}</p>
    </AuthCard>
  );
}
