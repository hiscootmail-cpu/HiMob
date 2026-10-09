"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { toggleBlockedDay } from "@/app/host/reservations/actions";
import { Button } from "@/components/ui/button";

/** Bloquear ↔ Desbloquear um dia do equipamento no calendário. */
export function DayBlockButton({ equipmentId, day, blocked }: { equipmentId: string; day: string; blocked: boolean }) {
  const t = useTranslations("host.calendar");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await toggleBlockedDay(equipmentId, day, !blocked);
      if (result.error) {
        toast.error(t(result.error === "booked" ? "blockBooked" : "blockError"));
        return;
      }
      toast.success(result.blocked ? t("blockedDone") : t("unblockedDone"));
      router.refresh();
    });
  }

  return (
    <Button variant={blocked ? "outline" : "secondary"} loading={pending} onClick={toggle} className="w-full sm:w-fit">
      {blocked ? t("unblock") : t("block")}
    </Button>
  );
}
