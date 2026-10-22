"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { startTransition, useActionState } from "react";

import { openTicket, type SupportState } from "@/app/help/actions";
import { Button } from "@/components/ui/button";

const TOPICS = ["payment", "booking", "handoff", "damage", "identity", "host", "other"] as const;

/** "Falar com a equipe": abre um atendimento (as mensagens ficam salvas). */
export function ContactForm({ signedIn, bookingId }: { signedIn: boolean; bookingId?: string }) {
  const t = useTranslations("help");
  const [state, action, pending] = useActionState(openTicket, {} as SupportState);

  if (!signedIn) {
    return (
      <Button asChild className="w-full sm:w-fit">
        <Link href="/auth/login">{t("signInToTalk")}</Link>
      </Button>
    );
  }

  const field =
    "w-full rounded-md border border-line bg-hs-white px-4 text-base text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25";
  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        startTransition(() => action(formData));
      }}
    >
      {bookingId ? <input type="hidden" name="booking" value={bookingId} /> : null}
      <label className="flex flex-col gap-1.5 text-sm font-medium text-hs-black">
        {t("topicLabel")}
        <select name="topic" defaultValue={bookingId ? "booking" : ""} className={`${field} h-11`}>
          <option value="" disabled>
            {t("topicPlaceholder")}
          </option>
          {TOPICS.map((topic) => (
            <option key={topic} value={topic}>
              {t(`topics.${topic}`)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-hs-black">
        {t("messageLabel")}
        <textarea name="message" rows={4} maxLength={2000} placeholder={t("messagePlaceholder")} className={`${field} py-3`} />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full sm:w-fit">
        {t("sendToTeam")}
      </Button>
    </form>
  );
}
