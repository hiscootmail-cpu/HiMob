"use client";

import Link from "next/link";
import { Clock, ShieldX } from "lucide-react";
import { useTranslations } from "next-intl";

import { AuthCard } from "@/components/auth/auth-card";
import { VerifiedBadgeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { LetterForm } from "./letter-form";

function HomeButton() {
  const t = useTranslations("verifyIdentity");
  return (
    <Button asChild size="lg" variant="outline" className="w-full">
      <Link href="/">{t("goHome")}</Link>
    </Button>
  );
}

/** Documento enviado, esperando a conferência da equipe. */
export function PendingCard() {
  const t = useTranslations("verifyIdentity.pending");
  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<Clock className="size-12 text-on-blue" aria-hidden />}
    >
      <HomeButton />
    </AuthCard>
  );
}

/** Segunda recusa: cadastro bloqueado. Continua vendo o site, sem alugar nem anunciar. */
export function BlockedCard() {
  const t = useTranslations("verifyIdentity.blocked");
  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<ShieldX className="size-12 text-error" aria-hidden />}
    >
      <p className="text-sm text-hs-black">{t("canBrowse")}</p>
      <LetterForm />
      <HomeButton />
    </AuthCard>
  );
}

/** Nome do documento conferido com o cadastro. */
export function ApprovedCard() {
  const t = useTranslations("verifyIdentity.approved");
  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      icon={<VerifiedBadgeIcon className="size-12 text-hs-black" />}
    >
      <HomeButton />
    </AuthCard>
  );
}
