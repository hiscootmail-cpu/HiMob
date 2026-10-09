"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cancelBooking, type CancelState } from "@/app/rider/reservations/actions";
import { ChatIcon, QrCodeIcon, StarIcon, WalletIcon } from "@/components/icons";
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
import { canCancel, type Booking } from "@/lib/bookings";
import { cn } from "@/lib/utils";

/** Botão principal de cada situação (inventário de ações + pagamento do PDF). */
function PrimaryAction({ booking }: { booking: Booking }) {
  const t = useTranslations("rider.actions");
  const base = `/rider/reservations/${booking.id}`;

  switch (booking.status) {
    case "accepted":
      return (
        <Button asChild>
          <Link href={`${base}/payment`}>
            <WalletIcon />
            {t("pay")}
          </Link>
        </Button>
      );
    case "confirmed":
      return (
        <Button asChild>
          <Link href={`${base}/pickup`}>
            <QrCodeIcon />
            {t("confirmPickup")}
          </Link>
        </Button>
      );
    case "active":
      return (
        <Button asChild>
          <Link href={`${base}/return`}>
            <QrCodeIcon />
            {t("confirmReturn")}
          </Link>
        </Button>
      );
    case "completed":
      return booking.rider_reviewed ? null : (
        <Button asChild variant="secondary">
          <Link href={`${base}/review`}>
            <StarIcon />
            {t("review")}
          </Link>
        </Button>
      );
    default:
      return null;
  }
}

/** Cancelar: ação irreversível, por isso pede confirmação e usa o vermelho. */
function CancelButton({ booking }: { booking: Booking }) {
  const t = useTranslations("rider.actions");
  const [state, action, pending] = useActionState(cancelBooking.bind(null, booking.id), {} as CancelState);

  if (state.done) {
    return (
      <p role="status" className="text-sm font-medium text-hs-black">
        {t("cancelled")}
      </p>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" loading={pending}>
          {t("cancel")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t("cancelTitle")}</AlertDialogTitle>
        <AlertDialogDescription>{t("cancelText")}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("keep")}</AlertDialogCancel>
          <form action={action}>
            <AlertDialogAction type="submit" destructive className="w-full">
              {t("cancelConfirm")}
            </AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Ações de uma reserva: botão principal, falar com o Host e cancelar. */
export function BookingActions({
  booking,
  showDetails = true,
  className,
}: {
  booking: Booking;
  showDetails?: boolean;
  className?: string;
}) {
  const t = useTranslations("rider.actions");

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
    >
      <PrimaryAction booking={booking} />
      {showDetails ? (
        <Button asChild variant="outline">
          <Link href={`/rider/reservations/${booking.id}`}>{t("details")}</Link>
        </Button>
      ) : null}
      {booking.status === "rejected" || booking.status === "cancelled" ? null : (
        <Button asChild variant="ghost">
          <Link href={`/conversations/${booking.equipment.id}`}>
            <ChatIcon />
            {t("talkToHost")}
          </Link>
        </Button>
      )}
      {canCancel(booking.status) ? <CancelButton booking={booking} /> : null}
    </div>
  );
}
