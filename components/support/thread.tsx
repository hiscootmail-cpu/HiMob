import { useFormatter, useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { SupportTicket } from "@/lib/support";
import { cn } from "@/lib/utils";

/** Conversa do atendimento: mensagens da pessoa e da equipe Hi Scoot. */
export function Thread({ ticket, viewer }: { ticket: SupportTicket; viewer: "user" | "team" }) {
  const t = useTranslations("help");
  const format = useFormatter();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {ticket.kind === "sos" ? <Badge tone="error">SOS</Badge> : null}
        <Badge tone={ticket.status === "open" ? "pending" : ticket.status === "answered" ? "info" : "neutral"}>{t(`status.${ticket.status}`)}</Badge>
        <span className="text-sm text-muted">{t(`topics.${ticket.topic}`)}</span>
      </div>
      {ticket.latitude !== null && ticket.longitude !== null ? (
        <a
          href={`https://www.openstreetmap.org/?mlat=${ticket.latitude}&mlon=${ticket.longitude}#map=17/${ticket.latitude}/${ticket.longitude}`}
          target="_blank"
          rel="noreferrer"
          className="w-fit text-sm font-semibold text-hs-black underline underline-offset-2"
        >
          {t("seeLocation")}
        </a>
      ) : null}
      <ol className="flex flex-col gap-2">
        {ticket.messages.map((m) => {
          const fromUs = m.from_team || m.from_ai;
          const right = viewer === "team" ? fromUs : !fromUs;
          return (
            <li key={m.id} className={cn("flex", right ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-lg px-3 py-2", m.from_ai ? "bg-purple-soft" : right ? "bg-green-soft" : "bg-surface")}>
                <p className="text-xs font-semibold text-hs-black">
                  {m.from_ai ? t("assistant") : m.from_team ? t("team") : viewer === "team" ? (ticket.user_name ?? t("person")) : t("you")}
                </p>
                <p className="text-sm whitespace-pre-line text-hs-black">{m.body}</p>
                <p className="mt-1 text-[11px] text-muted">
                  {format.dateTime(new Date(m.created_at), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
