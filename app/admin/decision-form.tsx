"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import type { DecisionState } from "@/app/admin/actions";
import { CheckCircleIcon } from "@/components/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { REASON_MAX, REASON_MIN, validateReason } from "@/lib/admin-rules";

type Action = (decision: "approve" | "reject", prev: DecisionState, formData: FormData) => Promise<DecisionState>;

type DecisionFormProps = {
  id: string;
  action: Action;
  /** Recusar bloqueia o cadastro (2ª recusa de documento): ação irreversível. */
  rejectBlocks?: boolean;
};

/** Campo Motivo + Recusar / Aprovar (inventário de ações). Motivo obrigatório para recusar. */
export function DecisionForm({ id, action, rejectBlocks = false }: DecisionFormProps) {
  const t = useTranslations("admin.decision");
  const formRef = useRef<HTMLFormElement>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<NonNullable<DecisionState["error"]> | null>(null);
  const [state, run, pending] = useActionState(
    (prev: DecisionState, payload: { decision: "approve" | "reject"; formData: FormData }) => action(payload.decision, prev, payload.formData),
    {} as DecisionState,
  );

  if (state.done) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-semibold text-hs-black">
        <CheckCircleIcon className="size-5 text-on-green" />
        {t(`done.${state.done}`)}
      </p>
    );
  }

  const send = (decision: "approve" | "reject") => {
    if (!formRef.current) return;
    const formData = new FormData(formRef.current);
    startTransition(() => run({ decision, formData }));
  };

  const error = localError ?? (state.error ? state.error : null);
  const reasonId = `reason-${id}`;

  return (
    <form ref={formRef} onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={reasonId} className="text-sm font-medium text-hs-black">
          {t("reasonLabel")}
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
          placeholder={t("reasonPlaceholder")}
          aria-invalid={error && error !== "notAllowed" ? true : undefined}
          aria-describedby={`${reasonId}-message`}
          className="w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none placeholder:text-muted focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line"
        />
        <p id={`${reasonId}-message`} role={error ? "alert" : undefined} className={error ? "text-sm text-error" : "text-sm text-muted"}>
          {error ? t(`errors.${error}`, { min: REASON_MIN, max: REASON_MAX }) : t("reasonHint")}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => {
            const problem = validateReason(reason);
            if (problem) {
              setLocalError(problem);
              return;
            }
            setConfirmOpen(true);
          }}
        >
          {t("reject")}
        </Button>
        <Button type="button" loading={pending} onClick={() => send("approve")}>
          {t("approve")}
        </Button>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{rejectBlocks ? t("blockTitle") : t("rejectTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{rejectBlocks ? t("blockText") : t("rejectText")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction destructive={rejectBlocks} onClick={() => send("reject")}>
              {rejectBlocks ? t("blockConfirm") : t("rejectConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
