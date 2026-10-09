import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { ChatIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { listConversations } from "@/lib/conversations";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("conversations");
  return { title: t("title") };
}

/** Lista de conversas: cada conversa é um link inteiro para o chat. */
export default async function ConversationsPage() {
  await requireUser();
  const t = await getTranslations("conversations");
  const format = await getFormatter();
  const conversations = await listConversations();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center">
          <ChatIcon className="size-10 text-muted" />
          <h2 className="text-base font-semibold text-hs-black">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted">{t("emptyText")}</p>
          <Button asChild>
            <Link href="/">{t("explore")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-hs-white">
          {conversations.map((c) => {
            const last = c.messages.at(-1);
            return (
              <li key={c.id}>
                <Link
                  href={`/conversations/${c.id}`}
                  className="flex items-center gap-3 p-4 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 focus-visible:ring-inset"
                >
                  <EquipmentPhoto type={c.equipment.type} className="size-14 shrink-0 rounded-md" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-base text-hs-black", c.unread ? "font-bold" : "font-semibold")}>
                        {c.other.name}
                      </span>
                      {last ? (
                        <span className="shrink-0 text-xs text-muted">
                          {format.relativeTime(new Date(last.sent_at), new Date())}
                        </span>
                      ) : null}
                    </span>
                    <span className="truncate text-sm text-muted">
                      {t(c.my_role === "host" ? "aboutYour" : "about", { title: c.equipment.title })}
                    </span>
                    <span className={cn("truncate text-sm", c.unread ? "font-semibold text-hs-black" : "text-muted")}>
                      {last ? `${last.mine ? `${t("you")}: ` : ""}${last.body}` : t("noMessages")}
                    </span>
                  </span>
                  {c.unread ? (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-hs-green px-1.5 text-xs font-bold text-on-green">
                      <span className="sr-only">{t("unread", { count: c.unread })}</span>
                      <span aria-hidden>{c.unread}</span>
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
