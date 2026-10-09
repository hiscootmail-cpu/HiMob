import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { identityStatuses, type IdentityCheck, type IdentityStatus } from "@/lib/identity";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { ResubmitForm } from "./resubmit-form";
import { ApprovedCard, BlockedCard, PendingCard } from "./status-cards";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("verifyIdentity");
  return { title: t("title") };
}

type PageCheck = IdentityCheck & { firstTime?: boolean };

/**
 * Situação da conta, lida no servidor (as regras do banco só entregam a da
 * própria pessoa). Um envio ainda não analisado mostra "em análise".
 */
async function getRealCheck(): Promise<PageCheck | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: secret }, { data: waiting }] = await Promise.all([
    supabase.from("profiles").select("identity_status").eq("id", user.id).maybeSingle(),
    supabase.from("profile_private").select("identity_rejections, identity_reason").eq("id", user.id).maybeSingle(),
    supabase.from("identity_submissions").select("id").eq("user_id", user.id).eq("status", "pending").limit(1),
  ]);
  const status = (profile?.identity_status as IdentityStatus | undefined) ?? "pending";
  const base = { rejections: secret?.identity_rejections ?? 0, reason: secret?.identity_reason ?? undefined };
  if (status === "approved") return { ...base, status };
  if (waiting?.length) return { ...base, status: "pending" };
  if (status === "pending") return { ...base, status: "rejected", reason: undefined, firstTime: true };
  return { ...base, status };
}

/*
 * Modo de demonstração (sem Supabase): a situação vem do endereço
 * (/verify-identity?preview=pending|rejected|blocked|approved) só para
 * conferir as telas.
 */
async function getIdentityCheck(preview: string | undefined, exampleReason: string): Promise<PageCheck> {
  const status: IdentityStatus = identityStatuses.includes(preview as IdentityStatus)
    ? (preview as IdentityStatus)
    : "rejected";
  return { status, rejections: status === "blocked" ? 2 : status === "rejected" ? 1 : 0, reason: exampleReason };
}

export default async function VerifyIdentityPage({ searchParams }: PageProps<"/verify-identity">) {
  const { preview } = await searchParams;
  const t = await getTranslations("verifyIdentity");
  const check = supabaseConfigured()
    ? await getRealCheck()
    : await getIdentityCheck(typeof preview === "string" ? preview : undefined, t("rejected.exampleReason"));
  if (!check) redirect("/auth/login");

  return (
    <div className="flex flex-1 justify-center bg-surface px-4 py-10 sm:py-16">
      <div className="w-full max-w-md">
        {check.status === "rejected" ? <ResubmitForm reason={check.reason} firstTime={check.firstTime} /> : null}
        {check.status === "pending" ? <PendingCard /> : null}
        {check.status === "blocked" ? <BlockedCard /> : null}
        {check.status === "approved" ? <ApprovedCard /> : null}
      </div>
    </div>
  );
}
