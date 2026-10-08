import type { Metadata } from "next";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth.error");
  return { title: t("title") };
}

export default async function AuthErrorPage() {
  const t = await getTranslations("auth.error");

  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<CircleAlert className="size-12 text-error" aria-hidden />}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="sm:flex-1">
          <Link href="/">{t("goHome")}</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="sm:flex-1">
          <Link href="/auth/login">{t("goToLogin")}</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
