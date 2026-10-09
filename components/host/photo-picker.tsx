"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { CameraIcon, PlusIcon } from "@/components/icons";
import { MAX_PHOTOS, MIN_PHOTOS } from "@/lib/equipment";
import { PHOTO_ACCEPT, PHOTO_MAX_MB } from "@/lib/handoff";
import { cn } from "@/lib/utils";

type PhotoPickerProps = {
  files: File[];
  onChange: (files: File[]) => void;
  error?: string;
  /** Texto extra abaixo do título (ex.: na edição, "as fotos atuais ficam"). */
  note?: string;
};

/**
 * Fotos do anúncio: de 4 a 10. Mostra as escolhidas em grade, com remover.
 * A primeira foto é a capa do anúncio.
 */
export function PhotoPicker({ files, onChange, error, note }: PhotoPickerProps) {
  const t = useTranslations("host.form");
  const inputId = React.useId();
  const messageId = `${inputId}-message`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previews = React.useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);

  React.useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function add(list: FileList | null) {
    if (!list?.length) return;
    onChange([...files, ...Array.from(list)].slice(0, MAX_PHOTOS));
    if (inputRef.current) inputRef.current.value = "";
  }

  const full = files.length >= MAX_PHOTOS;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={error ? messageId : undefined}>
      <legend className="mb-1 text-sm font-medium text-hs-black">{t("photosLabel")}</legend>
      <p className="text-sm text-muted">{t("photosHelp", { min: MIN_PHOTOS, max: MAX_PHOTOS, size: PHOTO_MAX_MB })}</p>
      {note ? <p className="text-sm text-hs-black">{note}</p> : null}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? messageId : undefined}
        onChange={(event) => add(event.currentTarget.files)}
        disabled={full}
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {files.map((file, index) => (
          <li key={`${file.name}-${index}`} className="relative aspect-square overflow-hidden rounded-md border border-line bg-surface">
            {/* Prévia local, só no aparelho do Host. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previews[index]} alt={t("photoAlt", { number: index + 1 })} className="size-full object-cover" />
            {index === 0 ? (
              <span className="absolute top-2 left-2 rounded-full bg-hs-white px-2 py-0.5 text-xs font-semibold text-hs-black">
                {t("cover")}
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => onChange(files.filter((_, i) => i !== index))}
              aria-label={t("photoRemove", { number: index + 1 })}
              className="absolute top-2 right-2 flex size-9 cursor-pointer items-center justify-center rounded-full bg-hs-white text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
            >
              <Trash2 className="size-5" aria-hidden />
            </button>
          </li>
        ))}
        {full ? null : (
          <li className="aspect-square">
            <label
              htmlFor={inputId}
              className={cn(
                "flex size-full cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed bg-hs-white p-2 text-center text-sm font-medium text-hs-black hover:bg-surface",
                error ? "border-error-line" : "border-line",
              )}
            >
              {files.length ? <PlusIcon className="size-6" /> : <CameraIcon className="size-6" />}
              {files.length ? t("photosAdd") : t("photosChoose")}
            </label>
          </li>
        )}
      </ul>

      <p className="text-sm text-muted" aria-live="polite">
        {t("photosCount", { count: files.length, max: MAX_PHOTOS })}
      </p>
      {error ? (
        <p id={messageId} role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
