"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { setAvailability } from "@/app/host/equipment/actions";
import { Button } from "@/components/ui/button";

/** Marcar indisponível ↔ Marcar disponível (texto alterna, inventário de ações). */
export function AvailabilityToggle({ listingId, initial }: { listingId: string; initial: boolean }) {
  const t = useTranslations("host.listings");
  const [available, setAvailable] = useState(initial);
  const [pending, startTransition] = useTransition();

  function toggle() {
    startTransition(async () => {
      const result = await setAvailability(listingId, !available);
      if (result.error) {
        toast.error(t("availabilityError"));
        return;
      }
      setAvailable(!available);
      toast.success(available ? t("markedUnavailable") : t("markedAvailable"));
    });
  }

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
      <p className="text-sm text-hs-black" aria-live="polite">
        {available ? t("isAvailable") : t("isUnavailable")}
      </p>
      <Button variant="outline" size="sm" loading={pending} onClick={toggle}>
        {available ? t("markUnavailable") : t("markAvailable")}
      </Button>
    </div>
  );
}
