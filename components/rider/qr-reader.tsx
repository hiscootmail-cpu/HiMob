"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, VideoOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { CheckCircleIcon, QrCodeIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/text-field";
import { cn } from "@/lib/utils";

type CameraState = "idle" | "starting" | "scanning" | "denied" | "unavailable";

type QrReaderProps = {
  /** Nome do campo enviado no formulário. */
  name: string;
  error?: string;
  onChange?: (code: string) => void;
};

/**
 * Leitura do QR code pela câmera do celular, com a opção de digitar o código.
 * Usa a biblioteca qr-scanner: no Android usa o leitor do próprio navegador;
 * no iPhone, que ainda não tem esse leitor, usa um leitor em JavaScript.
 * A câmera só liga quando a pessoa toca no botão, e desliga depois da leitura.
 */
export function QrReader({ name, error, onChange }: QrReaderProps) {
  const t = useTranslations("rider.qr");
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<{ stop: () => void; destroy: () => void } | null>(null);
  const [camera, setCamera] = useState<CameraState>("idle");
  const [code, setCode] = useState("");
  const [scanned, setScanned] = useState(false);

  useEffect(() => () => scannerRef.current?.destroy(), []);

  function update(value: string, fromCamera: boolean) {
    setCode(value);
    setScanned(fromCamera);
    onChange?.(value);
  }

  async function startCamera() {
    if (!videoRef.current) return;
    setCamera("starting");
    try {
      const { default: QrScanner } = await import("qr-scanner");
      if (!(await QrScanner.hasCamera())) {
        setCamera("unavailable");
        return;
      }
      const scanner = new QrScanner(
        videoRef.current,
        (result) => {
          update(result.data, true);
          scanner.stop();
          setCamera("idle");
        },
        { preferredCamera: "environment", highlightScanRegion: true, returnDetailedScanResult: true },
      );
      scannerRef.current = scanner;
      await scanner.start();
      setCamera("scanning");
    } catch {
      setCamera("denied");
    }
  }

  function stopCamera() {
    scannerRef.current?.stop();
    setCamera("idle");
  }

  const cameraOn = camera === "starting" || camera === "scanning";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-sm font-medium text-hs-black">{t("label")}</p>

      <div
        className={cn(
          "relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg bg-hs-black",
          !cameraOn && "hidden",
        )}
      >
        <video ref={videoRef} className="size-full object-cover" muted playsInline aria-label={t("videoLabel")} />
        {camera === "starting" ? (
          <LoaderCircle className="absolute size-8 animate-spin text-hs-white" aria-hidden />
        ) : null}
      </div>

      {cameraOn ? (
        <Button type="button" variant="outline" onClick={stopCamera}>
          {t("stopCamera")}
        </Button>
      ) : scanned ? (
        <div role="status" className="flex items-center gap-2 rounded-md bg-green-soft px-4 py-3">
          <CheckCircleIcon className="size-5 text-on-green" />
          <span className="text-sm font-semibold text-on-green">{t("scanned")}</span>
        </div>
      ) : (
        <Button type="button" variant="secondary" size="lg" onClick={startCamera}>
          <QrCodeIcon />
          {t("openCamera")}
        </Button>
      )}

      {camera === "denied" || camera === "unavailable" ? (
        <p role="alert" className="flex items-start gap-2 text-sm text-error">
          <VideoOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          {camera === "denied" ? t("cameraDenied") : t("cameraUnavailable")}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-muted">{t("typeCode")}</span>
        <Input
          name={name}
          value={code}
          onChange={(event) => update(event.currentTarget.value, false)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t("codePlaceholder")}
          aria-invalid={error ? true : undefined}
          className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
      </label>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
