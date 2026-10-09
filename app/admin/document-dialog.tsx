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
export function DocumentDialog({ kind, name }: { kind: "document" | "letter"; name: string }) {
  const t = useTranslations("admin.document");
  const parts = kind === "document" ? [t("front"), t("back")] : [t("letter")];

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
          {parts.map((part) => (
            <figure key={part} className="flex flex-col gap-1.5">
              <div className="flex aspect-[3/2] items-center justify-center rounded-md border border-dashed border-line bg-surface text-sm text-muted">
                {t("example")}
              </div>
              <figcaption className="text-sm font-medium text-hs-black">{part}</figcaption>
            </figure>
          ))}
        </div>
        <p className="text-sm text-hs-black">{kind === "document" ? t("checkDocument") : t("checkLetter")}</p>
      </DialogContent>
    </Dialog>
  );
}
