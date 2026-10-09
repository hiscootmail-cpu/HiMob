"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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

export function ToastDemo() {
  const t = useTranslations("designSystem.toast");

  return (
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" onClick={() => toast.success(t("successTitle"), { description: t("successText") })}>
        {t("showSuccess")}
      </Button>
      <Button variant="outline" onClick={() => toast.error(t("errorTitle"), { description: t("errorText") })}>
        {t("showError")}
      </Button>
    </div>
  );
}

export function DialogDemo() {
  const t = useTranslations("designSystem.dialog");

  return (
    <div className="flex flex-wrap gap-3">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">{t("openNormal")}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>{t("normalTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("normalText")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction>{t("confirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline">{t("openIrreversible")}</Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>{t("irreversibleTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("irreversibleText")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction destructive>{t("irreversibleConfirm")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
