"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, BellOff, LifeBuoy, TicketPercent } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { ChatIcon, CheckCircleIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { MonthCalendar } from "@/components/equipment/month-calendar";
import { GAP_HOURS, type Schedule } from "@/lib/availability-rules";
import { daysBetween, rentalHours, saoPauloTime, timeSlots } from "@/lib/booking";
import { durationText } from "@/lib/duration";
import { discountedBreakdown, hostHourlyPrice, PLATFORM_FEE_PERCENT, rentalHostAmount, riderDailyPrice } from "@/lib/pricing";
import { JETBOARD_MIN_AGE, type Equipment } from "@/lib/equipment";
import { cn } from "@/lib/utils";
import { checkCoupon, requestBooking, startConversation, toggleWaitlist, type BookingRequestState, type CouponError, type CouponPreview } from "./actions";

type BookingPanelProps = {
  equipment: Equipment;
  /** Hoje em São Paulo (AAAA-MM-DD), vindo do servidor. */
  today: string;
  /** A pessoa que está vendo é a dona do anúncio? */
  isOwner: boolean;
  /** Dias liberados pelo Host e horários já ocupados (decisões de 20/10/2026). */
  schedule: Schedule;
  /** A pessoa já pediu "Avisar quando disponível"? */
  onWaitlist?: boolean;
  /**
   * Documento só na hora de alugar (decisões de 19 e 20/10/2026): "send" = ainda
   * não enviou; "review" = em análise. Até a aprovação, só vê e conversa.
   */
  verification?: "send" | "review" | null;
  /** Jetboard: a pessoa já informou a data de nascimento? Se não, pede aqui. */
  hasBirthDate?: boolean;
};

type LocalError = "pickupInPast" | "returnBeforePickup" | "tooShort" | "timesTaken";

const HOUR_MS = 60 * 60 * 1000;

function TimeSelect({
  id,
  name,
  label,
  value,
  options,
  onChange,
  invalid,
  placeholder,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  invalid: boolean;
  placeholder: string;
}) {
  return (
    <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1 rounded-md border border-line px-3 py-2 focus-within:border-hs-blue focus-within:ring-4 focus-within:ring-hs-blue/25">
      <span className="text-xs font-semibold tracking-wide text-hs-black uppercase">{label}</span>
      <select
        id={id}
        name={name}
        value={value}
        aria-invalid={invalid || undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
        className="w-full min-w-0 bg-transparent text-base text-hs-black outline-none"
      >
        <option value="">{placeholder}</option>
        {options.map((time) => (
          <option key={time} value={time}>
            {time}
          </option>
        ))}
      </select>
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

/**
 * Quadro de reserva (decisões de 20/10/2026): o Rider escolhe no calendário os
 * dias liberados pelo Host e a hora de retirar e de devolver, de 30 em 30
 * minutos, dentro do atendimento. Mínimo de 1 hora. O preço sai da diária.
 */
export function BookingPanel({ equipment, today, isOwner, schedule, onWaitlist = false, verification = null, hasBirthDate = false }: BookingPanelProps) {
  const t = useTranslations("equipment");
  const tDuration = useTranslations("duration");
  const format = useFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });

  const openFrom = equipment.pickup_time.slice(0, 5);
  const openUntil = equipment.return_time.slice(0, 5);
  const slots = timeSlots(openFrom, openUntil);
  const startSlots = openUntil > openFrom ? slots.filter((time) => time < openUntil) : slots;
  const endSlots = openUntil > openFrom ? slots.filter((time) => time > openFrom) : slots;
  const available = new Set(schedule.available);
  const firstMonth = today.slice(0, 7);
  const lastMonth = (schedule.available.at(-1) ?? today).slice(0, 7);

  const [month, setMonth] = useState(schedule.available[0]?.slice(0, 7) ?? firstMonth);
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const pickup = range?.start ?? "";
  const dropoff = range?.end ?? "";

  const selectDay = (day: string) => {
    setRange((current) => {
      // Primeiro toque (ou nova escolha): um dia só. Segundo toque num dia depois: até ele.
      if (!current || current.end !== current.start || day < current.start) return { start: day, end: day };
      if (day === current.start) return current;
      const allFree = daysBetween(current.start, day).every((d) => available.has(d));
      return allFree ? { start: current.start, end: day } : { start: day, end: day };
    });
  };

  // Cupom (decisões de 20/10/2026): aluguel grátis, ou x% no aluguel e y% na taxa.
  const [couponOpen, setCouponOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<({ code: string; error?: CouponError } & Partial<CouponPreview>) | null>(null);
  const [checkingCoupon, startCouponCheck] = useTransition();
  const appliedCoupon = coupon && !coupon.error ? coupon.code : "";
  const applyCoupon = () => {
    const code = couponInput.replace(/\s/g, "").toUpperCase();
    if (!code) return;
    startCouponCheck(async () => {
      const result = await checkCoupon(equipment.id, code, pickup, dropoff);
      setCoupon(result.ok ? { code, kind: result.kind, rentalPercent: result.rentalPercent, feePercent: result.feePercent } : { code, error: result.error });
    });
  };
  // Controlado: o campo não se apaga se o pedido voltar com erro.
  const [birthDate, setBirthDate] = useState("");
  const [state, formAction, pending] = useActionState(requestBooking.bind(null, equipment.id), {} as BookingRequestState);
  const [waitlist, waitlistAction, waitlistPending] = useActionState(toggleWaitlist.bind(null, equipment.id), {
    onWaitlist,
  });

  const complete = Boolean(pickup && dropoff && startTime && endTime);
  const startMs = complete ? saoPauloTime(pickup, startTime) : 0;
  const endMs = complete ? saoPauloTime(dropoff, endTime) : 0;
  const hours = complete ? rentalHours(pickup, startTime, dropoff, endTime) : 0;
  // Date.now() só serve de aviso; o servidor confere de novo na hora do pedido.
  // eslint-disable-next-line react-hooks/purity -- aviso na tela, não decide nada
  const now = Date.now();
  const localError: LocalError | null = !complete
    ? null
    : startMs < now
      ? "pickupInPast"
      : endMs <= startMs
        ? "returnBeforePickup"
        : hours < 1
          ? "tooShort"
          : schedule.busy.some((b) => startMs < b.end + GAP_HOURS * HOUR_MS && b.start < endMs + GAP_HOURS * HOUR_MS)
            ? "timesTaken"
            : null;
  const error = localError ?? state.error;
  const hostAmount = rentalHostAmount(equipment.daily_price, openFrom, openUntil, hours);
  const freeCoupon = Boolean(appliedCoupon) && (coupon?.kind === "free" || (coupon?.rentalPercent === 100 && coupon?.feePercent === 100));
  const breakdown = discountedBreakdown(
    hostAmount,
    appliedCoupon && !freeCoupon ? (coupon?.rentalPercent ?? 0) : 0,
    appliedCoupon && !freeCoupon ? (coupon?.feePercent ?? 0) : 0,
  );
  const hourly = riderDailyPrice(hostHourlyPrice(equipment.daily_price, openFrom, openUntil));

  // Horários já ocupados nos dias escolhidos (para a pessoa evitar).
  const time = (ms: number) =>
    format.dateTime(new Date(ms), { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  const shortDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });
  const busyShown = range
    ? schedule.busy.filter((b) => b.end + GAP_HOURS * HOUR_MS > saoPauloTime(range.start, "00:00") && b.start < saoPauloTime(range.end, "23:59"))
    : [];

  const header = (
    <div className="flex flex-col gap-0.5">
      <p className="text-hs-black">
        <span className="text-2xl font-bold text-hs-black">{money(riderDailyPrice(equipment.daily_price))}</span>
        <span className="text-base text-muted"> {t("perDay")}</span>
      </p>
      <p className="text-sm text-hs-black">{t("orPerHour", { price: money(hourly) })}</p>
      <p className="text-xs text-muted">{t("feeIncluded", { percent: PLATFORM_FEE_PERCENT })}</p>
    </div>
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
            <p className="text-sm text-hs-black">{state.free ? t("requestSentFree") : t("requestSentText")}</p>
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
        <fieldset className="flex min-w-0 flex-col gap-3">
          <legend className="mb-2 text-sm font-semibold text-hs-black">{t("chooseDays")}</legend>
          {schedule.available.length === 0 ? (
            <p className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">{t("noDaysYet")}</p>
          ) : (
            <>
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                minMonth={firstMonth}
                maxMonth={lastMonth < firstMonth ? firstMonth : lastMonth}
                onSelect={selectDay}
                dayLook={(day) =>
                  range && day === range.start
                    ? "selected"
                    : range && day > range.start && day <= range.end
                      ? "inRange"
                      : available.has(day) && day >= today
                        ? "available"
                        : "off"
                }
                dayLabel={(_, look) => t(`dayLook.${look}`)}
              />
              <p className="text-xs text-muted">{t("calendarHelp")}</p>
            </>
          )}
          {range ? (
            <p className="text-sm font-semibold text-hs-black">
              {range.start === range.end
                ? t("chosenDay", { day: shortDate(range.start) })
                : t("chosenDays", { start: shortDate(range.start), end: shortDate(range.end) })}
            </p>
          ) : null}
          {range ? (
            <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
              <TimeSelect
                id="pickup-time"
                name="pickup_time"
                label={t("pickupTime")}
                value={startTime}
                options={startSlots}
                onChange={setStartTime}
                invalid={error === "pickupInPast"}
                placeholder={t("timePick")}
              />
              <TimeSelect
                id="return-time"
                name="return_time"
                label={t("returnTime")}
                value={endTime}
                options={endSlots}
                onChange={setEndTime}
                invalid={error === "returnBeforePickup" || error === "tooShort"}
                placeholder={t("timePick")}
              />
            </div>
          ) : null}
          <p className="text-xs text-muted">{t("hostHours", { from: openFrom, until: openUntil })}</p>
          {busyShown.length ? (
            <p className="text-sm text-hs-black">
              {t("busyTimes", {
                times: busyShown.map((b) => `${shortDate(new Date(b.start).toISOString().slice(0, 10))} ${time(b.start)}–${time(b.end)}`).join(", "),
              })}
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-error">
              {t(`errors.${error}`)}
            </p>
          ) : null}
        </fieldset>
        <input type="hidden" name="pickup_date" value={pickup} />
        <input type="hidden" name="return_date" value={dropoff} />

        {complete && !localError ? (
          <dl className="flex flex-col gap-2 rounded-md bg-surface px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-hs-black">{t("rentalOf", { duration: durationText(tDuration, hours) })}</dt>
              <dd className="text-hs-black">{money(breakdown.fullTotal)}</dd>
            </div>
            <p className="text-xs text-muted">
              {t("feeIncludedLine", { percent: PLATFORM_FEE_PERCENT, fee: money(breakdown.fee + breakdown.feeDiscount) })}
            </p>
            {freeCoupon ? (
              <div className="flex justify-between gap-3 text-on-green">
                <dt>{t("couponLine", { code: appliedCoupon })}</dt>
                <dd className="whitespace-nowrap">- {money(breakdown.fullTotal)}</dd>
              </div>
            ) : null}
            {!freeCoupon && breakdown.rentalDiscount > 0 ? (
              <div className="flex justify-between gap-3 text-on-green">
                <dt>{t("couponRental", { code: appliedCoupon, percent: coupon?.rentalPercent ?? 0 })}</dt>
                <dd className="whitespace-nowrap">- {money(breakdown.rentalDiscount)}</dd>
              </div>
            ) : null}
            {!freeCoupon && breakdown.feeDiscount > 0 ? (
              <div className="flex justify-between gap-3 text-on-green">
                <dt>{t("couponFee", { code: appliedCoupon, percent: coupon?.feePercent ?? 0 })}</dt>
                <dd className="whitespace-nowrap">- {money(breakdown.feeDiscount)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-line pt-2 font-bold">
              <dt className="text-hs-black">{t("total")}</dt>
              <dd className="text-hs-black">{freeCoupon ? t("free") : money(breakdown.total)}</dd>
            </div>
          </dl>
        ) : null}

        <input type="hidden" name="coupon" value={appliedCoupon} />
        {couponOpen ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="coupon-code" className="text-sm font-medium text-hs-black">
              {t("couponLabel")}
            </label>
            <div className="flex gap-2">
              <input
                id="coupon-code"
                value={couponInput}
                onChange={(event) => {
                  setCouponInput(event.currentTarget.value);
                  setCoupon(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    applyCoupon();
                  }
                }}
                maxLength={30}
                autoCapitalize="characters"
                aria-invalid={coupon?.error ? true : undefined}
                aria-describedby="coupon-message"
                className="h-11 min-w-0 flex-1 rounded-md border border-line bg-hs-white px-4 text-base text-hs-black uppercase outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line"
              />
              <Button type="button" variant="outline" loading={checkingCoupon} onClick={applyCoupon}>
                {t("couponApply")}
              </Button>
            </div>
            <p
              id="coupon-message"
              role={coupon?.error ? "alert" : "status"}
              className={cn("text-sm", coupon?.error ? "text-error" : "text-on-green")}
            >
              {coupon?.error
                ? t(`errors.${coupon.error}`)
                : appliedCoupon
                  ? freeCoupon
                    ? t("couponApplied", { code: appliedCoupon })
                    : t("couponAppliedDiscount", { code: appliedCoupon, rental: coupon?.rentalPercent ?? 0, fee: coupon?.feePercent ?? 0 })
                  : null}
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCouponOpen(true)}
            className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-semibold text-hs-black underline underline-offset-2 outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            <TicketPercent className="size-4" aria-hidden />
            {t("couponOpen")}
          </button>
        )}

        {/* Jetboard (decisão de 22/10/2026): aviso de segurança e só para maiores de 21 anos. */}
        {equipment.type === "jetboard" ? (
          <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-3">
            <p role="note" className="flex gap-2 text-sm text-hs-black">
              <LifeBuoy className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{t("jetboardSafety", { age: JETBOARD_MIN_AGE })}</span>
            </p>
            {hasBirthDate ? null : (
              <TextField
                name="birth_date"
                type="date"
                value={birthDate}
                onChange={(event) => setBirthDate(event.currentTarget.value)}
                label={t("birthDateLabel")}
                hint={t("birthDateHint", { age: JETBOARD_MIN_AGE })}
                max={today}
                required
              />
            )}
          </div>
        ) : null}
        {verification ? (
          <p role="note" className="rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">
            {t.rich(verification === "send" ? "verifyToSend" : "verifyToBook", {
              link: (chunks) => (
                <Link href="/verify-identity" className="font-semibold underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={Boolean(verification) || !complete || Boolean(localError)}
          className="w-full"
        >
          {t("sendRequest")}
        </Button>
        <p className={cn("text-center text-xs text-muted")}>{t("payAfterAccept")}</p>
      </form>
      <TalkToHost equipmentId={equipment.id} label={t("talkToHost")} />
    </div>
  );
}
