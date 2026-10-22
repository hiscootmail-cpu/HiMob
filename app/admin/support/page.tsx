import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { BackLink } from "@/components/rider/back-link";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/session";
import { listAllTickets } from "@/lib/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.admin");
  return { title: t("title") };
}

/** Painel → Atendimento: SOS e atendimentos abertos primeiro (decisão de 22/10/2026). */
export default async function AdminSupportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");
  const t = await getTranslations("help");
  const format = await getFormatter();
  const tickets = await listAllTickets();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/admin" label={t("admin.back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("admin.title")}</h1>
        <p className="text-base text-muted">{t("admin.subtitle")}</p>
      </div>
      {tickets.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-base text-muted">{t("admin.empty")}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-hs-white">
          {tickets.map((ticket) => {
            const last = ticket.messages[ticket.messages.length - 1];
            return (
              <li key={ticket.id}>
                <Link href={`/admin/support/${ticket.id}`} className="flex flex-col gap-1 px-4 py-3 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40">
                  <span className="flex flex-wrap items-center gap-2">
                    {ticket.kind === "sos" ? <Badge tone="error">SOS</Badge> : null}
                    <Badge tone={ticket.status === "open" ? "pending" : ticket.status === "answered" ? "info" : "neutral"}>{t(`status.${ticket.status}`)}</Badge>
                    <span className="text-sm font-semibold text-hs-black">{ticket.user_name}</span>
                    <span className="text-sm text-muted">· {t(`topics.${ticket.topic}`)}</span>
                    <span className="ml-auto text-xs text-muted">{format.relativeTime(new Date(ticket.updated_at), new Date())}</span>
                  </span>
                  {last ? <span className="line-clamp-1 text-sm text-hs-black">{last.body}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
