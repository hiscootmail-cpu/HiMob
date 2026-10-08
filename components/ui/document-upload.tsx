"use client";

import * as React from "react";
import { FileText, RefreshCw, Trash2 } from "lucide-react";

import { CameraIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

export type DocumentUploadLabels = {
  label: string;
  /** Texto do botão grande quando não há arquivo. */
  choose: string;
  /** Formatos e tamanho aceitos (ex.: "JPG, PNG ou PDF, até 5 MB"). */
  limits: string;
  change: string;
  remove: string;
};

type DocumentUploadProps = {
  name: string;
  accept: string;
  labels: DocumentUploadLabels;
  error?: string;
  /** Id de um texto de apoio de fora (ex.: dicas de foto), lido junto com o campo. */
  describedBy?: string;
  /** Chamado sempre que a pessoa escolhe ou remove um arquivo. */
  onFileChange?: (file: File | null) => void;
  className?: string;
};

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Envio de documento (foto ou PDF). Mostra prévia da foto escolhida
 * e permite trocar ou remover antes do envio.
 * O arquivo é dado pessoal sensível (LGPD): nunca é mostrado a outras pessoas.
 */
function DocumentUpload({ name, accept, labels, error, describedBy, onFileChange, className }: DocumentUploadProps) {
  const inputId = React.useId();
  const messageId = `${inputId}-message`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function select(next: File | null) {
    setFile(next);
    setPreview(next && next.type.startsWith("image/") ? URL.createObjectURL(next) : null);
    onFileChange?.(next);
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    select(null);
  }

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium text-hs-black">
        {labels.label}
      </label>

      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type="file"
        accept={accept}
        className="sr-only"
        aria-invalid={error ? true : undefined}
        aria-describedby={[describedBy, error ? messageId : null].filter(Boolean).join(" ") || undefined}
        onChange={(event) => select(event.currentTarget.files?.[0] ?? null)}
      />

      {file ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-md border bg-hs-white p-3",
            error ? "border-error-line" : "border-line",
          )}
        >
          {preview ? (
            // Prévia local da foto escolhida, só no aparelho da própria pessoa.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-14 shrink-0 rounded-sm object-cover" />
          ) : (
            <span className="flex size-14 shrink-0 items-center justify-center rounded-sm bg-surface text-hs-black">
              <FileText className="size-6" aria-hidden />
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium text-hs-black">{file.name}</span>
            <span className="text-xs text-muted">{formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            aria-label={labels.change}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            <RefreshCw className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={clear}
            aria-label={labels.remove}
            className="flex size-9 cursor-pointer items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            <Trash2 className="size-5" aria-hidden />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed bg-hs-white px-4 py-6 text-center transition-colors hover:bg-surface",
            "[input:focus-visible+&]:ring-4 [input:focus-visible+&]:ring-hs-blue/40",
            error ? "border-error-line" : "border-line",
          )}
        >
          <CameraIcon className="size-8 text-hs-black" />
          <span className="text-sm font-semibold text-hs-black">{labels.choose}</span>
          <span className="text-xs text-muted">{labels.limits}</span>
        </label>
      )}

      {error ? (
        <p id={messageId} role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export { DocumentUpload };
