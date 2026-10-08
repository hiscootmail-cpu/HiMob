import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.error");
  return { title: t("title") };
}

/** Só texto informativo, sem botões (conforme o inventário de ações). */
export default async function AuthErrorPage() {
  const t = await getTranslations("auth.error");

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<CircleAlert className="size-12 text-danger" aria-hidden />}
    />
  );
}
