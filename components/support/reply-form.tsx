"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useRef } from "react";

import { sendMessage, type SupportState } from "@/app/help/actions";
import { Button } from "@/components/ui/button";

/** Responder no atendimento. A equipe também pode encerrar. */
export function ReplyForm({ ticketId, team = false }: { ticketId: string; team?: boolean }) {
  const t = useTranslations("help");
  const [state, action, pending] = useActionState(sendMessage.bind(null, ticketId), {} as SupportState);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={formRef}
      noValidate
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(async () => {
          await action(formData);
          formRef.current?.reset();
        });
      }}
    >
      <label htmlFor={`reply-${ticketId}`} className="text-sm font-medium text-hs-black">
        {team ? t("replyTeam") : t("reply")}
      </label>
      <textarea
        id={`reply-${ticketId}`}
        name="message"
        rows={3}
        maxLength={2000}
        className="w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25"
      />
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {team ? (
          <label className="flex items-center gap-2 text-sm text-hs-black">
            <input type="checkbox" name="close" className="size-4 accent-hs-green" />
            {t("closeTicket")}
          </label>
        ) : null}
        <Button type="submit" loading={pending}>
          {t("send")}
        </Button>
      </div>
    </form>
  );
}
