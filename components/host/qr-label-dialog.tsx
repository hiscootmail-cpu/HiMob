"use client";

import { Printer } from "lucide-react";
import { useTranslations } from "next-intl";

import { QrCodeIcon } from "@/components/icons";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * Etiqueta QR do equipamento (decisão de 09/10/2026): o Host imprime e cola no
 * equipamento. O mesmo QR serve para a retirada e para a devolução.
 * O desenho do QR (SVG) é gerado no servidor a partir do código.
 */
export function QrLabelDialog({ code, title, qrSvg }: { code: string; title: string; qrSvg: string }) {
  const t = useTranslations("host.label");

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCodeIcon />
          {t("open")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="overflow-y-auto">
        <DialogTitle>{t("title")}</DialogTitle>
        <DialogDescription>{t("text")}</DialogDescription>

        {/* Só esta parte sai na impressão (ver "print-label" em globals.css). */}
        <div className="print-label mx-auto flex w-64 flex-col items-center gap-2 rounded-md border-2 border-hs-black bg-hs-white p-4 text-center">
          <Wordmark className="text-xl" />
          <div
            role="img"
            aria-label={t("qrAlt", { code })}
            className="size-44 [&_svg]:size-full"
            // SVG gerado pela biblioteca qrcode no servidor, a partir do código (sem texto da pessoa).
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="font-mono text-2xl font-bold tracking-widest text-hs-black">{code}</p>
          <p className="text-xs text-hs-black">{t("labelHint")}</p>
          <p className="line-clamp-1 text-xs text-muted">{title}</p>
        </div>

        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-hs-black">
          <li>{t("tip1")}</li>
          <li>{t("tip2")}</li>
          <li>{t("tip3")}</li>
        </ul>

        <Button onClick={() => window.print()} className="w-full">
          <Printer aria-hidden />
          {t("print")}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
