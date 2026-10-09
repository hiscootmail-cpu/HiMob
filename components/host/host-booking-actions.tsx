"use client";

import { startTransition, useActionState, useState, useTransition } from "react";
import { useFormatter, useTranslations } from "next-intl";

import {
  decideBooking,
  hostCancelBooking,
  hostConfirmHandoff,
  reviewRider,
  type HostHandoffState,
  type RiderReviewState,
} from "@/app/host/reservations/actions";
import { CameraIcon, CheckCircleIcon, StarIcon } from "@/components/icons";
import { StarRating } from "@/components/rider/star-rating";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DocumentUpload } from "@/components/ui/document-upload";
import { REVIEW_COMMENT_MAX } from "@/lib/bookings";
import { hostCancelPolicy } from "@/lib/cancellation";
import { PHOTO_ACCEPT, PHOTO_MAX_MB, validatePhoto, type HandoffError, type HandoffKind } from "@/lib/handoff";
import type { HostBooking } from "@/lib/host";

type Outcome = "accepted" | "rejected" | "cancelled" | "pickup" | "return" | "reviewed";

/** Confirmar retirada ou devolução: foto obrigatória do equipamento. */
function HandoffDialog({ booking, kind, onDone }: { booking: HostBooking; kind: HandoffKind; onDone: () => void }) {
  const t = useTranslations("host.handoff");
  const [state, action, pending] = useActionState(
    async (prev: HostHandoffState, formData: FormData) => {
      const result = await hostConfirmHandoff(booking.id, kind, prev, formData);
      if (result.done) onDone();
      return result;
    },
    {} as HostHandoffState,
  );
  const [local, setLocal] = useState<{ submission: unknown; error?: HandoffError | null }>({ submission: state });
  const current = local.submission === state ? local : { submission: state };
  const error = current.error === undefined ? state.error : (current.error ?? undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const photo = formData.get("photo");
    const problem = validatePhoto(photo instanceof File ? photo : null);
    if (problem) {
      setLocal({ submission: state, error: problem });
      return;
    }
    startTransition(() => action(formData));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>
          <CameraIcon />
          {t(`${kind}.open`)}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="overflow-y-auto">
        <DialogTitle>{t(`${kind}.title`)}</DialogTitle>
        <DialogDescription>{t(`${kind}.text`, { name: booking.rider.full_name })}</DialogDescription>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <DocumentUpload
            name="photo"
            accept={PHOTO_ACCEPT}
            capture="environment"
            error={error ? t(`errors.${error}`, { max: PHOTO_MAX_MB }) : undefined}
            onFileChange={(file) => setLocal({ submission: state, error: file ? validatePhoto(file) : null })}
            labels={{
              label: t("photoLabel"),
              choose: t("photoChoose"),
              limits: t("photoLimits", { max: PHOTO_MAX_MB }),
              change: t("photoChange"),
              remove: t("photoRemove"),
            }}
          />
          <Button type="submit" loading={pending} className="w-full">
            {t(`${kind}.submit`)}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Avaliar o Rider: 1 a 5 estrelas + comentário opcional. */
function ReviewDialog({ booking, onDone }: { booking: HostBooking; onDone: () => void }) {
  const t = useTranslations("host.review");
  const [comment, setComment] = useState("");
  const [state, action, pending] = useActionState(
    async (prev: RiderReviewState, formData: FormData) => {
      const result = await reviewRider(booking.id, prev, formData);
      if (result.done) onDone();
      return result;
    },
    {} as RiderReviewState,
  );
  const [touched, setTouched] = useState<{ submission: unknown; rating?: boolean }>({ submission: state });
  const ratingTouched = touched.submission === state && touched.rating;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <StarIcon />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="overflow-y-auto">
        <DialogTitle>{t("title", { name: booking.rider.full_name })}</DialogTitle>
        <DialogDescription>{t("text")}</DialogDescription>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            startTransition(() => action(formData));
          }}
          className="flex flex-col gap-4"
        >
          <StarRating
            name="rating"
            legend={t("ratingLegend")}
            error={state.errors?.rating && !ratingTouched ? t("ratingRequired") : undefined}
            onChange={() => setTouched({ submission: state, rating: true })}
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-hs-black">{t("commentLabel")}</span>
            <textarea
              name="comment"
              rows={3}
              maxLength={REVIEW_COMMENT_MAX}
              value={comment}
              onChange={(event) => setComment(event.currentTarget.value)}
              placeholder={t("commentPlaceholder")}
              className="w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none placeholder:text-muted focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25"
            />
            <span className="self-end text-xs text-muted">
              {t("commentCount", { count: comment.length, max: REVIEW_COMMENT_MAX })}
            </span>
          </label>
          <Button type="submit" loading={pending} className="w-full">
            {t("submit")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Ações do Host em cada reserva recebida (inventário de ações + regra de cancelamento). */
export function HostBookingActions({ booking }: { booking: HostBooking }) {
  const t = useTranslations("host.actions");
  const format = useFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [pending, startDecision] = useTransition();
  const [error, setError] = useState(false);
  // O servidor confere de novo a regra antes de cancelar.
  const cancel = hostCancelPolicy(booking);

  if (outcome) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm font-medium text-hs-black">
        <CheckCircleIcon className="size-5 text-on-green" />
        {t(`done.${outcome}`, { name: booking.rider.full_name })}
      </p>
    );
  }

  const decide = (decision: "accept" | "reject") =>
    startDecision(async () => {
      const result = await decideBooking(booking.id, decision);
      if (result.done) setOutcome(result.done);
      else setError(true);
    });

  const cancelDialog = cancel.allowed ? (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost">{t("cancel")}</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
        <AlertDialogDescription>
          {cancel.paid
            ? t("cancelTextPaid", { refund: money(cancel.riderRefund), fee: money(cancel.hostFee) })
            : t("cancelTextUnpaid")}
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
          <AlertDialogAction
            destructive
            onClick={() =>
              startDecision(async () => {
                const result = await hostCancelBooking(booking.id);
                if (result.done) setOutcome("cancelled");
                else setError(true);
              })
            }
          >
            {t("cancelConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ) : null;

  const row = "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto";

  return (
    <div className="flex flex-col gap-2">
      {booking.status === "pending" ? (
        <div className={row}>
          <Button loading={pending} onClick={() => decide("accept")}>
            {t("accept")}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" disabled={pending}>
                {t("reject")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogTitle>{t("rejectTitle")}</AlertDialogTitle>
              <AlertDialogDescription>{t("rejectText", { name: booking.rider.full_name })}</AlertDialogDescription>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
                <AlertDialogAction destructive onClick={() => decide("reject")}>
                  {t("rejectConfirm")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      ) : null}

      {booking.status === "accepted" ? (
        <>
          <p className="text-sm text-muted">{t("waitingPayment")}</p>
          <div className={row}>{cancelDialog}</div>
        </>
      ) : null}

      {booking.status === "confirmed" ? (
        <div className={row}>
          <HandoffDialog booking={booking} kind="pickup" onDone={() => setOutcome("pickup")} />
          {cancelDialog}
        </div>
      ) : null}

      {booking.status === "active" ? (
        <div className={row}>
          <HandoffDialog booking={booking} kind="return" onDone={() => setOutcome("return")} />
        </div>
      ) : null}

      {booking.status === "completed" && !booking.host_reviewed ? (
        <div className={row}>
          <ReviewDialog booking={booking} onDone={() => setOutcome("reviewed")} />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-error">
          {t("error")}
        </p>
      ) : null}
    </div>
  );
}
