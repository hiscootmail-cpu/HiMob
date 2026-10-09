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
} as const;

/** Etiqueta com a situação da reserva. */
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations("rider.status");
  return <Badge tone={tones[status]}>{t(status)}</Badge>;
}
