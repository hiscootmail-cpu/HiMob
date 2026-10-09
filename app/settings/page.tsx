import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { signOut } from "@/app/auth/actions";
import { LanguageChoice } from "@/app/settings/language-choice";
import { ShieldAdminIcon, UserIcon, VerifiedBadgeIcon, type IconProps } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("settings");
  return { title: t("title") };
}

const identityTone = { approved: "success", pending: "pending", rejected: "error", blocked: "error" } as const;

function Row({ href, icon: Icon, label, extra }: { href: string; icon: React.ComponentType<IconProps>; label: string; extra?: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 p-4 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 focus-visible:ring-inset"
      >
        <Icon className="size-6 shrink-0" />
        <span className="flex-1 text-base font-medium text-hs-black">{label}</span>
        {extra}
        <ChevronRight className="size-5 shrink-0 text-hs-black" aria-hidden />
      </Link>
    </li>
  );
}

/** Configurações: idioma, conta e sair. */
export default async function SettingsPage() {
  const user = await requireUser();
  const t = await getTranslations("settings");
  const tIdentity = await getTranslations("settings.identity");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{user.email}</p>
      </div>

      <section aria-labelledby="language-title" className="flex flex-col gap-3">
        <h2 id="language-title" className="text-lg font-semibold text-hs-black">
          {t("languageTitle")}
        </h2>
        <LanguageChoice />
      </section>

      <section aria-labelledby="account-title" className="flex flex-col gap-3">
        <h2 id="account-title" className="text-lg font-semibold text-hs-black">
          {t("accountTitle")}
        </h2>
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-hs-white">
          <Row href={`/profile/${user.id}`} icon={UserIcon} label={t("viewProfile")} />
          <Row href="/profile/edit" icon={UserIcon} label={t("editProfile")} />
          <Row
            href="/verify-identity"
            icon={VerifiedBadgeIcon}
            label={t("identity.label")}
            extra={<Badge tone={identityTone[user.identity]}>{tIdentity(user.identity)}</Badge>}
          />
          {user.is_admin ? <Row href="/admin" icon={ShieldAdminIcon} label={t("admin")} /> : null}
        </ul>
      </section>

      <form action={signOut}>
        <Button type="submit" variant="outline" size="lg" className="w-full">
          <LogOut aria-hidden />
          {t("signOut")}
        </Button>
      </form>
    </div>
  );
}
