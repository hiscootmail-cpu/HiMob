import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import type { BookingStatus } from "@/lib/bookings";

const tones = {
  pending: "pending",
  accepted: "info",
  confirmed: "success",
  active: "highlight",
  completed: "neutral",
  rejected: "error",
  cancelled: "neutral",
  expired: "neutral",
} as const;

/** Etiqueta com a situação da reserva. */
export function BookingStatusBadge({ status, free = false }: { status: BookingStatus; free?: boolean }) {
  const t = useTranslations("rider.status");
  // Reserva grátis (cupom de ação): confirmada sem pagamento.
  return <Badge tone={tones[status]}>{free && status === "confirmed" ? t("confirmedFree") : t(status)}</Badge>;
}
