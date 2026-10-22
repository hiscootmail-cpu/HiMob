import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { ReplyForm } from "@/components/support/reply-form";
import { Thread } from "@/components/support/thread";
import { getCurrentUser } from "@/lib/session";
import { getTicket } from "@/lib/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.admin");
  return { title: t("title") };
}

/** Painel → Atendimento → conversa: a equipe responde e pode encerrar. */
export default async function AdminTicketPage({ params }: PageProps<"/admin/support/[id]">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) notFound();
  const t = await getTranslations("help");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/admin/support" label={t("admin.backList")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{ticket.user_name || t("person")}</h1>
      {ticket.booking_id ? (
        <p className="text-sm text-hs-black">
          {t("admin.booking")}{" "}
          <Link href={`/admin?tab=handoffs`} className="font-semibold underline underline-offset-2">
            {ticket.booking_id.slice(0, 8)}
          </Link>
        </p>
      ) : null}
      <Thread ticket={ticket} viewer="team" />
      <ReplyForm ticketId={ticket.id} team />
    </div>
  );
}
