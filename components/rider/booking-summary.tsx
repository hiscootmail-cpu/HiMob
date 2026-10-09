import { useFormatter, useTranslations } from "next-intl";

import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { BookingStatusBadge } from "@/components/rider/booking-status-badge";
import { bookingPrice, type Booking } from "@/lib/bookings";
import { cn } from "@/lib/utils";

/** Data AAAA-MM-DD mostrada como "12 de out." (sem mudar o dia por fuso horário). */
export function useShortDate() {
  const format = useFormatter();
  return (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Resumo da reserva: equipamento, datas, diárias, total e situação. */
export function BookingSummary({
  booking,
  showStatus = true,
  className,
}: {
  booking: Booking;
  showStatus?: boolean;
  className?: string;
}) {
  const t = useTranslations("rider");
  const format = useFormatter();
  const shortDate = useShortDate();
  const price = bookingPrice(booking);

  return (
    <div className={cn("flex gap-4", className)}>
      <EquipmentPhoto type={booking.equipment.type} className="size-20 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {showStatus ? <BookingStatusBadge status={booking.status} /> : null}
        <p className="line-clamp-2 text-base font-semibold text-hs-black">{booking.equipment.title}</p>
        <p className="text-sm text-muted">
          {t("dates", { start: shortDate(booking.start_date), end: shortDate(booking.end_date) })} ·{" "}
          {t("days", { count: booking.days })}
        </p>
        <p className="text-sm text-muted">
          {booking.equipment.area} · {t("hostLabel", { name: booking.equipment.host.full_name })}
        </p>
        <p className="text-base font-bold text-hs-black">
          {format.number(price.total, { style: "currency", currency: "BRL" })}
        </p>
      </div>
    </div>
  );
}
