"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { submitReview, type ReviewState } from "@/app/rider/reservations/actions";
import { CheckCircleIcon } from "@/components/icons";
import { StarRating } from "@/components/rider/star-rating";
import { Button } from "@/components/ui/button";
import { REVIEW_COMMENT_MAX } from "@/lib/bookings";

/** Avaliação (tela 9 do PDF): nota do equipamento, nota do Host e comentário. */
export function ReviewForm({ bookingId, hostName }: { bookingId: string; hostName: string }) {
  const t = useTranslations("rider.review");
  const [state, action, pending] = useActionState(submitReview.bind(null, bookingId), {} as ReviewState);
  const [comment, setComment] = useState("");
  const [touched, setTouched] = useState<{ submission: unknown; equipment?: boolean; host?: boolean }>({
    submission: state,
  });
  const current = touched.submission === state ? touched : { submission: state };

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-hs-white p-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-soft">
          <CheckCircleIcon className="size-9 text-on-green" />
        </span>
        <h2 className="text-xl font-bold text-hs-black">{t("doneTitle")}</h2>
        <p className="text-base text-muted">{t("doneText")}</p>
        <Button asChild size="lg" className="w-full">
          <Link href="/">{t("exploreMore")}</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-6 rounded-lg border border-line bg-hs-white p-5">
      <StarRating
        name="equipmentRating"
        legend={t("equipmentLegend")}
        error={state.errors?.equipment && !current.equipment ? t("errors.ratingRequired") : undefined}
        onChange={() => setTouched({ ...current, equipment: true })}
      />
      <StarRating
        name="hostRating"
        legend={t("hostLegend", { name: hostName })}
        error={state.errors?.host && !current.host ? t("errors.ratingRequired") : undefined}
        onChange={() => setTouched({ ...current, host: true })}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-hs-black">{t("commentLabel")}</span>
        <textarea
          name="comment"
          rows={4}
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
      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
