import { useTranslations } from "next-intl";

import { CheckCircleIcon } from "@/components/icons";
import type { BookingStatus } from "@/lib/bookings";
import { cn } from "@/lib/utils";

const steps = ["accepted", "paid", "ready", "inUse", "returned"] as const;

/** Quantas etapas já foram concluídas em cada situação. */
const doneCount: Record<BookingStatus, number> = {
  pending: 0,
  accepted: 1,
  confirmed: 3,
  active: 4,
  completed: 5,
  rejected: 0,
  cancelled: 0,
};

/** Etapa atual (destacada) em cada situação; -1 quando não há etapa em andamento. */
const currentIndex: Record<BookingStatus, number> = {
  pending: -1,
  accepted: 1,
  confirmed: 2,
  active: 3,
  completed: -1,
  rejected: -1,
  cancelled: -1,
};

/** Passo a passo da reserva (tela 6 do PDF): aceita, paga, pronta, em uso, devolvida. */
export function BookingSteps({ status }: { status: BookingStatus }) {
  const t = useTranslations("rider.steps");
  const done = doneCount[status];
  const current = currentIndex[status];

  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isDone = index < done && index !== current;
        const isCurrent = index === current;
        return (
          <li key={step} className="flex gap-3" aria-current={isCurrent ? "step" : undefined}>
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold",
                  isDone && "border-hs-green bg-hs-green text-on-green",
                  isCurrent && "border-hs-black bg-hs-black text-hs-white",
                  !isDone && !isCurrent && "border-line bg-hs-white text-muted",
                )}
              >
                {isDone ? <CheckCircleIcon className="size-5" /> : index + 1}
              </span>
              {index < steps.length - 1 ? (
                <span aria-hidden className={cn("w-0.5 flex-1 min-h-6", isDone ? "bg-hs-green" : "bg-line")} />
              ) : null}
            </div>
            <div className="flex flex-col pb-5">
              <span
                className={cn(
                  "text-sm",
                  isCurrent ? "font-semibold text-hs-black" : isDone ? "text-hs-black" : "text-muted",
                )}
              >
                {t(step)}
              </span>
              {isCurrent ? <span className="text-xs text-muted">{t(`${step}Hint`)}</span> : null}
              <span className="sr-only">{isDone ? t("doneLabel") : isCurrent ? t("currentLabel") : t("nextLabel")}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
