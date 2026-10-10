import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Lock } from "lucide-react";

import { ChatView } from "@/app/conversations/[id]/chat-view";
import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { VerifiedBadgeIcon } from "@/components/icons";
import { BackLink } from "@/components/rider/back-link";
import { getConversation, markConversationRead } from "@/lib/conversations";
import { requireUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/conversations/[id]">): Promise<Metadata> {
  const { id } = await params;
  const t = await getTranslations("conversations");
  const conversation = await getConversation(id);
  return { title: conversation ? t("chatTitle", { name: conversation.other.name }) : t("title") };
}

/** Chat: mensagens + Enviar. Contato da outra pessoa só com reserva aceita. */
export default async function ChatPage({ params }: PageProps<"/conversations/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const conversation = await getConversation(id);
  if (!conversation) notFound();
  if (!conversation.is_new) await markConversationRead(conversation.id);
  const t = await getTranslations("conversations");

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <BackLink href="/conversations" label={t("back")} />

      <div className="flex items-center gap-3 rounded-lg border border-line bg-hs-white p-3">
        <EquipmentPhoto type={conversation.equipment.type} className="size-12 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="flex items-center gap-1.5 text-lg font-bold text-hs-black">
            <Link
              href={`/profile/${conversation.other.id}`}
              className="truncate rounded-sm underline-offset-2 outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
            >
              {conversation.other.name}
            </Link>
            {conversation.other.verified ? (
              <VerifiedBadgeIcon className="size-5 shrink-0" title={t("verified")} />
            ) : null}
          </h1>
          <Link
            href={`/equipment/${conversation.equipment.id}`}
            className="truncate text-sm text-muted underline-offset-2 hover:underline"
          >
            {conversation.equipment.title}
          </Link>
        </div>
      </div>

      {conversation.other_contact ? (
        <div className="flex flex-col gap-0.5 rounded-md bg-green-soft px-4 py-3 text-sm">
          <p className="font-semibold text-on-green">{t("contactTitle")}</p>
          <p className="text-hs-black">
            {conversation.other_contact.phone} · {conversation.other_contact.email}
          </p>
        </div>
      ) : (
        <p className="flex gap-2 rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
          <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("contactHidden")}
        </p>
      )}

      <ChatView
        conversationId={conversation.id}
        initialMessages={conversation.messages}
        otherName={conversation.other.name}
        contactsHidden={!conversation.has_accepted_booking}
        liveId={conversation.is_new ? null : conversation.id}
        myId={user.id}
      />
    </div>
  );
}
