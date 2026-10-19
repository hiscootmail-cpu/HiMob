"use client";

import { useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { useTranslations } from "next-intl";

import { openIdentityFiles } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { IdentityFile } from "@/lib/admin";

type Part = IdentityFile["part"];

/**
 * "Ver documento enviado" (inventário de ações). Dado sensível (LGPD): só a
 * equipe abre. Os links são gerados pelo servidor na hora em que a janela abre
 * e valem 5 minutos (abrir de novo gera links novos). Foto aparece como
 * imagem; PDF aparece no leitor de PDF do navegador.
 * Na demonstração, a janela mostra só o aviso.
 */
export function DocumentDialog({ id, kind, name }: { id: string; kind: "document" | "letter"; name: string }) {
  const t = useTranslations("admin.document");
  const parts: Part[] = kind === "document" ? ["front", "back"] : ["letter"];
  const [files, setFiles] = useState<IdentityFile[] | null | "loading" | "error">(null);

  const load = async () => {
    setFiles("loading");
    const result = await openIdentityFiles(id).catch(() => null);
    setFiles(result ?? "error");
  };

  return (
    <Dialog onOpenChange={(open) => (open ? load() : setFiles(null))}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <FileText aria-hidden />
          {kind === "document" ? t("openDocument") : t("openLetter")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogTitle>{t("title", { name })}</DialogTitle>
        <DialogDescription>{t("privacy")}</DialogDescription>
        {files === "error" ? (
          <p role="alert" className="rounded-md border border-error-line bg-error-soft p-3 text-sm text-error">
            {t("loadError")}
          </p>
        ) : null}
        <div className="flex flex-col gap-4">
          {parts.map((part) => {
            const file = Array.isArray(files) ? files.find((f) => f.part === part) : undefined;
            return (
              <figure key={part} className="flex flex-col gap-1.5">
                <figcaption className="flex items-center justify-between gap-2 text-sm font-medium text-hs-black">
                  {t(part)}
                  {file ? (
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-semibold text-on-blue underline underline-offset-2 outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                    >
                      {t("openTab")}
                      <ExternalLink className="size-4" aria-hidden />
                    </a>
                  ) : null}
                </figcaption>
                {file ? (
                  file.pdf ? (
                    <iframe src={file.url} title={t(part)} className="h-[28rem] w-full rounded-md border border-line bg-surface" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.url} alt={t(part)} className="max-h-[28rem] w-full rounded-md border border-line bg-surface object-contain" />
                  )
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center rounded-md border border-dashed border-line bg-surface text-sm text-muted">
                    {files === "loading" ? t("loading") : Array.isArray(files) && files.length ? t("missing") : t("example")}
                  </div>
                )}
              </figure>
            );
          })}
        </div>
        <p className="text-sm text-hs-black">{kind === "document" ? t("checkDocument") : t("checkLetter")}</p>
        <p className="text-xs text-muted">{t("linkNote")}</p>
      </DialogContent>
    </Dialog>
  );
}
