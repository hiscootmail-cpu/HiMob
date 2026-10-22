import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { ContactForm } from "@/components/support/contact-form";
import { Badge } from "@/components/ui/badge";
import { isSignedIn } from "@/lib/session";
import { aiSupportOn } from "@/lib/ai-support";
import { listMyTickets } from "@/lib/support";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help");
  return { title: t("title") };
}

/** Perguntas prontas por assunto (decisão de 22/10/2026). A IA entra depois no chat. */
const FAQ = {
  payment: ["how", "when"],
  booking: ["deadlines", "cancel"],
  handoff: ["pickup", "late"],
  damage: ["who", "emergency"],
  account: ["document", "phone"],
  host: ["paid", "visible"],
} as const;

/** Central de ajuda: respostas prontas, "Falar com a equipe" e meus atendimentos. */
export default async function HelpPage({ searchParams }: PageProps<"/help">) {
  const t = await getTranslations("help");
  const format = await getFormatter();
  const { booking } = await searchParams;
  const signedIn = await isSignedIn();
  const tickets = signedIn ? await listMyTickets() : [];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>

      <section aria-labelledby="faq-title" className="flex flex-col gap-4">
        <h2 id="faq-title" className="text-lg font-semibold text-hs-black">
          {t("faqTitle")}
        </h2>
        {Object.entries(FAQ).map(([section, items]) => (
          <div key={section} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold tracking-wide text-muted uppercase">{t(`faq.${section}.title` as "faq.payment.title")}</h3>
            <div className="flex flex-col divide-y divide-line rounded-lg border border-line bg-hs-white">
              {items.map((item) => (
                <details key={item} className="group px-4 py-3">
                  <summary className="cursor-pointer list-none text-base font-medium text-hs-black marker:hidden">
                    <span className="flex items-center justify-between gap-3">
                      {t(`faq.${section}.${item}.q` as "faq.payment.how.q")}
                      <span aria-hidden className="text-muted transition-transform group-open:rotate-45">+</span>
                    </span>
                  </summary>
                  <p className="mt-2 text-sm whitespace-pre-line text-hs-black">{t(`faq.${section}.${item}.a` as "faq.payment.how.a")}</p>
                </details>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section id="contato" aria-labelledby="contact-title" className="flex scroll-mt-20 flex-col gap-3 rounded-lg border-2 border-hs-green bg-hs-white p-4 sm:p-5">
        <h2 id="contact-title" className="text-lg font-semibold text-hs-black">
          {t("contactTitle")}
        </h2>
        <p className="text-sm text-muted">{t("contactText")}</p>
        {aiSupportOn() ? <p className="rounded-md bg-purple-soft px-3 py-2 text-xs text-on-purple">{t("aiNotice")}</p> : null}
        <ContactForm signedIn={signedIn} bookingId={typeof booking === "string" ? booking : undefined} />
      </section>

      {tickets.length ? (
        <section aria-labelledby="mine-title" className="flex flex-col gap-3">
          <h2 id="mine-title" className="text-lg font-semibold text-hs-black">
            {t("mine")}
          </h2>
          <ul className="flex flex-col divide-y divide-line rounded-lg border border-line">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link href={`/help/${ticket.id}`} className="flex flex-wrap items-center gap-2 px-4 py-3 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40">
                  {ticket.kind === "sos" ? <Badge tone="error">SOS</Badge> : null}
                  <span className="min-w-0 flex-1 text-sm font-semibold text-hs-black">{t(`topics.${ticket.topic}`)}</span>
                  <Badge tone={ticket.status === "open" ? "pending" : ticket.status === "answered" ? "info" : "neutral"}>{t(`status.${ticket.status}`)}</Badge>
                  <span className="text-xs text-muted">{format.relativeTime(new Date(ticket.updated_at), new Date())}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
