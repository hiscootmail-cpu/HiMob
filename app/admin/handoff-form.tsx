"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";

import { confirmHandoffByPlatform, type HandoffDecisionState } from "@/app/admin/actions";
import { CheckCircleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { REASON_MAX, REASON_MIN, validateReason } from "@/lib/admin-rules";

/** "Confirmar pela plataforma" com motivo obrigatório (decisão de 10/10/2026). */
export function HandoffForm({ bookingId, kind }: { bookingId: string; kind: "pickup" | "return" }) {
  const t = useTranslations("admin");
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<ReturnType<typeof validateReason>>(null);
  const [state, action, pending] = useActionState(confirmHandoffByPlatform.bind(null, bookingId, kind), {} as HandoffDecisionState);

  if (state.done) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-hs-black">
        <CheckCircleIcon className="size-5 text-on-green" />
        {t("handoff.done")}
      </p>
    );
  }

  const error = localError ?? state.error ?? null;
  const reasonId = `reason-${bookingId}-${kind}`;

  return (
    <form
      action={action}
      onSubmit={(event) => {
        const problem = validateReason(reason);
        if (problem) {
          event.preventDefault();
          setLocalError(problem);
        }
      }}
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={reasonId} className="text-sm font-medium text-hs-black">
          {t("decision.reasonLabel")}
        </label>
        <textarea
          id={reasonId}
          name="reason"
          rows={2}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(event) => {
            setReason(event.currentTarget.value);
            setLocalError(null);
          }}
          placeholder={t("handoff.reasonPlaceholder")}
          aria-invalid={error && error !== "notAllowed" ? true : undefined}
          aria-describedby={`${reasonId}-message`}
          className="w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none placeholder:text-muted focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line"
        />
        <p id={`${reasonId}-message`} role={error ? "alert" : undefined} className={error ? "text-sm text-error" : "text-sm text-muted"}>
          {error === "reasonRequired"
            ? t("handoff.reasonRequired")
            : error
              ? t(`decision.errors.${error}`, { min: REASON_MIN, max: REASON_MAX })
              : t("handoff.reasonHint")}
        </p>
      </div>
      <Button type="submit" loading={pending} className="w-full sm:w-fit sm:self-end">
        {t("handoff.confirm")}
      </Button>
    </form>
  );
}
