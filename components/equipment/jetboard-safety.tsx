import { LifeBuoy } from "lucide-react";
import { useTranslations } from "next-intl";

import { JETBOARD_MIN_AGE } from "@/lib/equipment";

/** Aviso de segurança do jetboard (decisão de 22/10/2026), na reserva e na retirada. */
export function JetboardSafety() {
  const t = useTranslations("equipment");
  return (
    <p role="note" className="flex gap-2 rounded-md bg-surface px-4 py-3 text-sm text-hs-black">
      <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{t("jetboardSafety", { age: JETBOARD_MIN_AGE })}</span>
    </p>
  );
}
