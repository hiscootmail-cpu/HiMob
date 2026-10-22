import Link from "next/link";
import { useTranslations } from "next-intl";

import { CheckCircleIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type JourneyStep = {
  key: "identity" | "mercadoPago" | "listing" | "days" | "review" | "live";
  done: boolean;
  /** Em andamento (ex.: documento ou anúncio em análise). */
  waiting?: boolean;
  href?: string;
};

/**
 * "Seu caminho para anunciar" (decisão de 22/10/2026): mostra o que já foi
 * feito e o próximo passo, até o primeiro anúncio no ar. Some quando tudo está pronto.
 */
export function HostJourney({ steps }: { steps: JourneyStep[] }) {
  const t = useTranslations("host.journey");
  if (steps.every((s) => s.done)) return null;
  const next = steps.find((s) => !s.done && !s.waiting);
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <section aria-labelledby="journey-title" className="flex flex-col gap-4 rounded-lg border-2 border-hs-green bg-hs-white p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id="journey-title" className="text-lg font-semibold text-hs-black">
            {t("title")}
          </h2>
          <p className="text-sm text-muted">{t("progress", { done: doneCount, total: steps.length })}</p>
        </div>
        <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-surface sm:w-48">
          <div className="h-full rounded-full bg-hs-green" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
      </div>
      <ol className="flex flex-col gap-2">
        {steps.map((step, index) => {
          const current = step === next;
          return (
            <li
              key={step.key}
              className={cn(
                "flex flex-wrap items-center gap-3 rounded-md px-3 py-2",
                current ? "bg-green-soft" : step.done ? "bg-hs-white" : "bg-surface",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                  step.done ? "text-on-green" : "border border-line bg-hs-white text-hs-black",
                )}
              >
                {step.done ? <CheckCircleIcon className="size-6" /> : index + 1}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={cn("text-sm font-semibold", step.done ? "text-muted line-through" : "text-hs-black")}>
                  {t(`steps.${step.key}.title`)}
                </span>
                {!step.done ? (
                  <span className="text-xs text-muted">{t(step.waiting ? `steps.${step.key}.waiting` : `steps.${step.key}.text`)}</span>
                ) : null}
              </span>
              <span className="sr-only">{step.done ? t("done") : step.waiting ? t("waiting") : t("todo")}</span>
              {current && step.href ? (
                <Link
                  href={step.href}
                  className="inline-flex h-9 items-center rounded-full bg-hs-green px-4 text-sm font-semibold text-on-green outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                >
                  {t(`steps.${step.key}.action`)}
                </Link>
              ) : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
