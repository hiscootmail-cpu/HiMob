"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { SendHorizontal } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { sendMessage, type SendState } from "@/app/conversations/actions";
import { Button } from "@/components/ui/button";
import type { Message } from "@/lib/conversations";
import { HIDDEN_MARK, MESSAGE_MAX } from "@/lib/contact-filter";
import { createClient } from "@/lib/supabase/client";
import { supabaseConfigured } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

type ChatViewProps = {
  conversationId: string;
  initialMessages: Message[];
  otherName: string;
  /** Sem reserva aceita: telefone e e-mail aparecem como "•••". */
  contactsHidden: boolean;
  /** Com a Supabase: id da conversa no banco (null se ainda não existe) e da pessoa conectada. */
  liveId?: string | null;
  myId?: string;
};

type Row = { id: string; sender_id: string; body: string; created_at: string };

/** Mensagens e campo de envio. Enter envia; Shift + Enter pula linha. */
export function ChatView({ conversationId, initialMessages, otherName, contactsHidden, liveId = null, myId }: ChatViewProps) {
  const t = useTranslations("conversations");
  const format = useFormatter();
  const [sent, setSent] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [lastRedacted, setLastRedacted] = useState(false);
  const [realId, setRealId] = useState<string | null>(liveId);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const [state, action, pending] = useActionState(async (prev: SendState, formData: FormData) => {
    const result = await sendMessage(conversationId, prev, formData);
    if (result.conversationId) setRealId(result.conversationId);
    if (result.message) {
      setSent((list) => [...list, result.message!]);
      setBody("");
      setLastRedacted(Boolean(result.redacted));
    }
    return result;
  }, {} as SendState);

  // Sem repetir: a mensagem enviada também volta pelo tempo real.
  const messages = [...initialMessages, ...sent].filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i);

  // Tempo real: mensagens novas desta conversa chegam sozinhas (só para as duas pessoas).
  useEffect(() => {
    if (!supabaseConfigured() || !realId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`conversa-${realId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${realId}` },
        (payload) => {
          const row = payload.new as Row;
          setSent((list) => [...list, { id: row.id, mine: row.sender_id === myId, body: row.body, sent_at: row.created_at }]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [realId, myId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  function submit() {
    if (!formRef.current || pending) return;
    const formData = new FormData(formRef.current);
    startTransition(() => action(formData));
  }

  const time = (iso: string) =>
    format.dateTime(new Date(iso), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <div className="flex flex-1 flex-col gap-3">
      <div role="log" aria-label={t("messagesWith", { name: otherName })} className="flex flex-1 flex-col gap-3 rounded-lg bg-surface p-3 sm:p-4">
        {messages.length === 0 ? (
          <p className="m-auto py-10 text-center text-sm text-muted">{t("startConversation", { name: otherName })}</p>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={cn("flex max-w-[85%] flex-col gap-1", m.mine ? "self-end items-end" : "self-start items-start")}>
              <p
                className={cn(
                  "rounded-lg px-4 py-2.5 text-base break-words whitespace-pre-wrap",
                  m.mine ? "rounded-br-sm bg-hs-black text-hs-white" : "rounded-bl-sm border border-line bg-hs-white text-hs-black",
                )}
              >
                <span className="sr-only">{m.mine ? t("you") : otherName}: </span>
                {m.body}
              </p>
              <span className="text-xs text-muted">
                {time(m.sent_at)}
                {contactsHidden && m.body.includes(HIDDEN_MARK) ? ` · ${t("hiddenNote")}` : ""}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {lastRedacted ? (
        <p role="status" className="text-sm text-hs-black">
          {t("redactedNotice")}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`, { max: MESSAGE_MAX })}
        </p>
      ) : null}

      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <label htmlFor="chat-body" className="sr-only">
          {t("messageLabel")}
        </label>
        <textarea
          id="chat-body"
          name="body"
          rows={1}
          maxLength={MESSAGE_MAX}
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={t("messagePlaceholder")}
          className="max-h-40 min-h-11 w-full min-w-0 flex-1 resize-y rounded-lg border border-line bg-hs-white px-4 py-2.5 text-base text-hs-black outline-none placeholder:text-muted focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25"
        />
        <Button type="submit" loading={pending} disabled={!body.trim()} aria-label={t("send")} className="shrink-0">
          <SendHorizontal aria-hidden />
          <span className="hidden sm:inline">{t("send")}</span>
        </Button>
      </form>
    </div>
  );
}
