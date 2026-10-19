"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";

import { deleteAccount, type DeleteAccountState } from "@/app/settings/actions";
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
import { Button } from "@/components/ui/button";

/** Excluir minha conta: ação irreversível, por isso pede confirmação e usa o vermelho. */
export function DeleteAccount() {
  const t = useTranslations("settings.delete");
  const [state, action, pending] = useActionState(async () => deleteAccount(), {} as DeleteAccountState);

  return (
    <section aria-labelledby="delete-title" className="flex flex-col gap-3">
      <h2 id="delete-title" className="text-lg font-semibold text-hs-black">
        {t("title")}
      </h2>
      <p className="text-sm text-hs-black">{t("text")}</p>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" loading={pending} className="w-full sm:w-fit">
            {t("button")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>{t("confirmTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("confirmText")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <form action={action}>
              <AlertDialogAction type="submit" destructive className="w-full">
                {t("confirm")}
              </AlertDialogAction>
            </form>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
    </section>
  );
}
