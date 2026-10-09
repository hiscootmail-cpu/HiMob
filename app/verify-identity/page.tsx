import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { identityStatuses, type IdentityCheck, type IdentityStatus } from "@/lib/identity";
import { ResubmitForm } from "./resubmit-form";
import { ApprovedCard, BlockedCard, PendingCard } from "./status-cards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("verifyIdentity");
  return { title: t("title") };
}

/*
 * PROVISÓRIO até o Supabase entrar: a situação vem do endereço
 * (/verify-identity?preview=pending|rejected|blocked|approved) só para
 * conferir as telas. Depois, ela vem da conta da pessoa, lida no servidor.
 */
async function getIdentityCheck(preview: string | undefined, exampleReason: string): Promise<IdentityCheck> {
  const status: IdentityStatus = identityStatuses.includes(preview as IdentityStatus)
    ? (preview as IdentityStatus)
    : "rejected";
  return { status, rejections: status === "blocked" ? 2 : status === "rejected" ? 1 : 0, reason: exampleReason };
}

export default async function VerifyIdentityPage({ searchParams }: PageProps<"/verify-identity">) {
  const { preview } = await searchParams;
  const t = await getTranslations("verifyIdentity");
  const check = await getIdentityCheck(typeof preview === "string" ? preview : undefined, t("rejected.exampleReason"));

  return (
    <div className="flex flex-1 justify-center bg-surface px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        {check.status === "rejected" ? <ResubmitForm reason={check.reason} /> : null}
        {check.status === "pending" ? <PendingCard /> : null}
        {check.status === "blocked" ? <BlockedCard /> : null}
        {check.status === "approved" ? <ApprovedCard /> : null}
      </div>
    </div>
  );
}
