import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { becomeHost, createListing } from "@/app/host/equipment/actions";
import { KeyIcon, VerifiedBadgeIcon } from "@/components/icons";
import { ListingForm } from "@/components/host/listing-form";
import { BackLink } from "@/components/rider/back-link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.new");
  return { title: t("title") };
}

/** Criar anúncio. Quem ainda não é Host vê primeiro o "Quero ser Host". */
export default async function NewListingPage({ searchParams }: PageProps<"/host/equipment/new">) {
  const t = await getTranslations("host.new");
  const { preview } = await searchParams;
  // Com a Supabase, vale a conta de verdade; na demonstração, ?preview=new-host
  // mostra a tela de quem ainda não é Host.
  let notHost = preview === "new-host";
  let needsVerification = false;
  if (supabaseConfigured()) {
    const user = await requireUser();
    notHost = !user.is_host;
    // Só anuncia depois da verificação de identidade (decisão de 19/10/2026).
    needsVerification = user.identity !== "approved";
  }

  if (needsVerification) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-hs-white p-6 text-center sm:p-8">
          <span className="flex size-16 items-center justify-center rounded-full bg-blue-soft">
            <VerifiedBadgeIcon className="size-9" />
          </span>
          <h1 className="text-2xl font-bold text-hs-black">{t("verifyTitle")}</h1>
          <p className="text-base text-muted">{t("verifyText")}</p>
          <Button asChild size="lg" className="w-full">
            <Link href="/verify-identity">{t("verifyButton")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (notHost) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-hs-white p-6 text-center sm:p-8">
          <span className="flex size-16 items-center justify-center rounded-full bg-green-soft">
            <KeyIcon className="size-9 text-on-green" />
          </span>
          <h1 className="text-2xl font-bold text-hs-black">{t("becomeTitle")}</h1>
          <p className="text-base text-muted">{t("becomeText")}</p>
          <ul className="flex w-full flex-col gap-2 text-left text-sm text-hs-black">
            <li className="rounded-md bg-surface px-4 py-3">{t("becomeStep1")}</li>
            <li className="rounded-md bg-surface px-4 py-3">{t("becomeStep2")}</li>
            <li className="rounded-md bg-surface px-4 py-3">{t("becomeStep3")}</li>
          </ul>
          <form action={becomeHost} className="w-full">
            <Button type="submit" size="lg" className="w-full">
              {t("becomeButton")}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/host/equipment" label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>
      <ListingForm action={createListing} mode="new" />
    </div>
  );
}
