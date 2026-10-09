"use client";

import { startTransition, useActionState, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { confirmHandoff, type HandoffState } from "@/app/rider/reservations/actions";
import { CameraIcon, CheckCircleIcon } from "@/components/icons";
import { QrReader } from "@/components/rider/qr-reader";
import { Button } from "@/components/ui/button";
import { DocumentUpload } from "@/components/ui/document-upload";
import { PHOTO_ACCEPT, PHOTO_MAX_MB, validatePhoto, type HandoffError, type HandoffKind } from "@/lib/handoff";

type HandoffFormProps = { bookingId: string; kind: HandoffKind };

/** Confirmar retirada ou devolução: QR code + foto do equipamento (regra 8). */
export function HandoffForm({ bookingId, kind }: HandoffFormProps) {
  const t = useTranslations("rider.handoff");
  const [state, action, pending] = useActionState(confirmHandoff.bind(null, bookingId, kind), {} as HandoffState);
  const [local, setLocal] = useState<{ submission: unknown; code?: HandoffError | null; photo?: HandoffError | null }>({
    submission: state,
  });

  if (state.done) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-line bg-hs-white p-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-green-soft">
          <CheckCircleIcon className="size-9 text-on-green" />
        </span>
        <h2 className="text-xl font-bold text-hs-black">{t(`${kind}.doneTitle`)}</h2>
        <p className="text-base text-muted">{t(`${kind}.doneText`)}</p>
        <Button asChild size="lg" className="w-full">
          <Link href={kind === "pickup" ? `/rider/reservations/${bookingId}` : `/rider/reservations/${bookingId}/review`}>
            {t(`${kind}.next`)}
          </Link>
        </Button>
      </div>
    );
  }

  const current = local.submission === state ? local : { submission: state };
  const pick = (value: HandoffError | null | undefined, server: HandoffError | undefined) =>
    value === undefined ? server : (value ?? undefined);
  const codeError = pick(current.code, state.errors?.code);
  const photoError = pick(current.photo, state.errors?.photo);
  const errorText = (key: HandoffError | undefined) => (key ? t(`errors.${key}`, { max: PHOTO_MAX_MB }) : undefined);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Envio manual: não limpa o formulário, para não perder a foto se o código estiver errado.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const photo = formData.get("photo");
    const photoProblem = validatePhoto(photo instanceof File ? photo : null);
    if (photoProblem === "photoTooLarge" || photoProblem === "photoType") {
      setLocal({ ...current, photo: photoProblem });
      return;
    }
    startTransition(() => action(formData));
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <section className="flex flex-col gap-2 rounded-lg border border-line bg-hs-white p-4">
        <h2 className="text-base font-semibold text-hs-black">{t("step1")}</h2>
        <p className="text-sm text-muted">{t(`${kind}.qrHelp`)}</p>
        <QrReader
          name="code"
          error={errorText(codeError)}
          onChange={() => setLocal({ ...current, code: null })}
        />
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-line bg-hs-white p-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-hs-black">
          <CameraIcon className="size-5" />
          {t("step2")}
        </h2>
        <p className="text-sm text-muted">{t(`${kind}.photoHelp`)}</p>
        <DocumentUpload
          name="photo"
          accept={PHOTO_ACCEPT}
          capture="environment"
          error={errorText(photoError)}
          onFileChange={(file) => setLocal({ ...current, photo: file ? validatePhoto(file) : null })}
          labels={{
            label: t("photoLabel"),
            choose: t("photoChoose"),
            limits: t("photoLimits", { max: PHOTO_MAX_MB }),
            change: t("photoChange"),
            remove: t("photoRemove"),
          }}
        />
      </section>

      <Button type="submit" size="lg" loading={pending} className="w-full">
        {t(`${kind}.submit`)}
      </Button>
    </form>
  );
}
