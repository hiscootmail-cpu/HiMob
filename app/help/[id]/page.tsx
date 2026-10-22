import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { ReplyForm } from "@/components/support/reply-form";
import { Thread } from "@/components/support/thread";
import { getCurrentUser } from "@/lib/session";
import { getTicket } from "@/lib/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("ticketTitle") };
}

/** Conversa com a equipe Hi Scoot (mensagens salvas). */
export default async function TicketPage({ params, searchParams }: PageProps<"/help/[id]">) {
  if (!(await getCurrentUser())) redirect("/auth/login");
  const { id } = await params;
  const { sos } = await searchParams;
  const ticket = await getTicket(id);
  if (!ticket) notFound();
  const t = await getTranslations("help");

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/help" label={t("back")} />
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("ticketTitle")}</h1>
      {sos ? (
        <p role="status" className="rounded-md bg-pink-soft px-4 py-3 text-sm font-semibold text-on-pink">
          {t("sosSent")}
        </p>
      ) : (
        <p className="rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">{t("ticketInfo")}</p>
      )}
      <Thread ticket={ticket} viewer="user" />
      <ReplyForm ticketId={ticket.id} />
    </div>
  );
}
