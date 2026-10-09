"use client";

import { FileText } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * "Ver documento enviado" (inventário de ações). Dado sensível (LGPD): só a
 * equipe abre. PROVISÓRIO: ainda sem arquivo de verdade; com o Supabase, o
 * servidor gera um link que vale poucos minutos e só para a equipe.
 */
export function DocumentDialog({
  kind,
  name,
  files,
}: {
  kind: "document" | "letter";
  name: string;
  /** Links temporários para os arquivos (com a Supabase). */
  files?: { part: "front" | "back" | "letter"; url: string }[];
}) {
  const t = useTranslations("admin.document");
  const parts: ("front" | "back" | "letter")[] = kind === "document" ? ["front", "back"] : ["letter"];

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full sm:w-auto">
          <FileText aria-hidden />
          {kind === "document" ? t("openDocument") : t("openLetter")}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={t("close")} className="overflow-y-auto">
        <DialogTitle>{t("title", { name })}</DialogTitle>
        <DialogDescription>{t("privacy")}</DialogDescription>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {parts.map((part) => {
            const url = files?.find((f) => f.part === part)?.url;
            return (
              <figure key={part} className="flex flex-col gap-1.5">
                {url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="block rounded-md outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40">
                    {/* Link temporário (5 minutos). PDF abre em outra aba. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={t(part)} className="aspect-[3/2] w-full rounded-md border border-line bg-surface object-contain" />
                  </a>
                ) : (
                  <div className="flex aspect-[3/2] items-center justify-center rounded-md border border-dashed border-line bg-surface text-sm text-muted">
                    {t("example")}
                  </div>
                )}
                <figcaption className="text-sm font-medium text-hs-black">{t(part)}</figcaption>
              </figure>
            );
          })}
        </div>
        <p className="text-sm text-hs-black">{kind === "document" ? t("checkDocument") : t("checkLetter")}</p>
      </DialogContent>
    </Dialog>
  );
}
