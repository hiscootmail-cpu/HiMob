import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { CheckCircleIcon } from "@/components/icons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.signUpSuccess");
  return { title: t("title") };
}

export default async function SignUpSuccessPage() {
  const t = await getTranslations("auth.signUpSuccess");

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<CheckCircleIcon className="size-12 text-on-green" />}
    >
      <p className="text-sm text-muted">{t("spamHint")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <Link href="/auth/login">{t("goToLogin")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="sm:flex-1">
          <Link href="/">{t("goHome")}</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
