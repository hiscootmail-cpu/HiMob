"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ChatIcon, CheckCircleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { addDays, bookingTotal, countDays, validateBookingDates } from "@/lib/booking";
import type { Equipment } from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { requestBooking, startConversation, toggleWaitlist, type BookingRequestState } from "./actions";

type BookingPanelProps = {
  equipment: Equipment;
  /** Hoje em São Paulo (AAAA-MM-DD), vindo do servidor. */
  today: string;
  /** A pessoa que está vendo é a dona do anúncio? */
  isOwner: boolean;
};

function DateField({
  id,
  name,
  label,
  value,
  min,
  onChange,
  invalid,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  min: string;
  onChange: (value: string) => void;
  invalid: boolean;
}) {
  return (
    <label htmlFor={id} className="flex flex-1 flex-col gap-1 rounded-md border border-line px-3 py-2 focus-within:border-hs-blue focus-within:ring-4 focus-within:ring-hs-blue/25">
      <span className="text-xs font-semibold tracking-wide text-hs-black uppercase">{label}</span>
      <input
        id={id}
        name={name}
        type="date"
        value={value}
        min={min}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full bg-transparent text-base text-hs-black outline-none"
      />
    </label>
  );
}

function TalkToHost({ equipmentId, label }: { equipmentId: string; label: string }) {
  return (
    <form action={startConversation.bind(null, equipmentId)}>
      <Button type="submit" variant="outline" className="w-full">
        <ChatIcon />
        {label}
      </Button>
    </form>
  );
}

/** Quadro de reserva: preço por dia, datas, total e ações (inventário de ações). */
export function BookingPanel({ equipment, today, isOwner }: BookingPanelProps) {
  const t = useTranslations("equipment");
  const format = useFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });

  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [state, formAction, pending] = useActionState(requestBooking.bind(null, equipment.id), {} as BookingRequestState);
  const [waitlist, waitlistAction, waitlistPending] = useActionState(toggleWaitlist.bind(null, equipment.id), {
    onWaitlist: false,
  });

  const days = countDays(pickup, dropoff);
  const localError = pickup && dropoff ? validateBookingDates(pickup, dropoff, today) : null;
  const error = localError ?? state.error;

  const header = (
    <p className="text-hs-black">
      <span className="text-2xl font-bold text-hs-black">{money(equipment.daily_price)}</span>
      <span className="text-base text-muted"> {t("perDay")}</span>
    </p>
  );

  if (isOwner) {
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p role="note" className="rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">
          {t("ownerNotice")}
        </p>
      </div>
    );
  }

  if (!equipment.is_available) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">{t("unavailableNotice")}</p>
        <form action={waitlistAction}>
          <Button type="submit" variant={waitlist.onWaitlist ? "outline" : "secondary"} loading={waitlistPending} className="w-full">
            {waitlist.onWaitlist ? <BellOff aria-hidden /> : <Bell aria-hidden />}
            {waitlist.onWaitlist ? t("cancelNotify") : t("notifyMe")}
          </Button>
        </form>
        {waitlist.onWaitlist ? (
          <p role="status" className="text-sm text-muted">
            {t("notifyOn")}
          </p>
        ) : null}
        <TalkToHost equipmentId={equipment.id} label={t("talkToHost")} />
      </div>
    );
  }

  if (state.done) {
    return (
      <div className="flex flex-col gap-4">
        {header}
        <div role="status" className="flex gap-3 rounded-md bg-green-soft px-4 py-3">
          <CheckCircleIcon className="size-6 shrink-0 text-on-green" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-on-green">{t("requestSentTitle")}</p>
            <p className="text-sm text-hs-black">{t("requestSentText")}</p>
          </div>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/rider/reservations">{t("seeMyReservations")}</Link>
        </Button>
        <TalkToHost equipmentId={equipment.id} label={t("talkToHost")} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {header}
      <form action={formAction} className="flex flex-col gap-4">
        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold text-hs-black">{t("chooseDates")}</legend>
          <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
            <DateField
              id="pickup"
              name="pickup"
              label={t("pickup")}
              value={pickup}
              min={today}
              invalid={error === "pickupInPast" || error === "pickupRequired"}
              onChange={(value) => {
                setPickup(value);
                if (dropoff && value >= dropoff) setDropoff(addDays(value, 1));
              }}
            />
            <DateField
              id="return"
              name="return"
              label={t("return")}
              value={dropoff}
              min={pickup ? addDays(pickup, 1) : addDays(today, 1)}
              invalid={error === "returnBeforePickup" || error === "returnRequired"}
              onChange={setDropoff}
            />
          </div>
          {error ? (
            <p role="alert" className="text-sm text-error">
              {t(`errors.${error}`)}
            </p>
          ) : null}
        </fieldset>

        {days > 0 && !localError ? (
          <dl className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-hs-black">{t("priceTimesDays", { price: money(equipment.daily_price), count: days })}</dt>
              <dd className="text-hs-black">{money(bookingTotal(days, equipment.daily_price))}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-2 font-bold">
              <dt className="text-hs-black">{t("total")}</dt>
              <dd className="text-hs-black">{money(bookingTotal(days, equipment.daily_price))}</dd>
            </div>
          </dl>
        ) : null}

        <Button type="submit" size="lg" loading={pending} disabled={!pickup || !dropoff || Boolean(localError)} className="w-full">
          {t("sendRequest")}
        </Button>
        <p className={cn("text-center text-xs text-muted")}>{t("payAfterAccept")}</p>
      </form>
      <TalkToHost equipmentId={equipment.id} label={t("talkToHost")} />
    </div>
  );
}
