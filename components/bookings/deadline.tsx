"use client";

import { Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

type DeadlineKind = "riderWaitHost" | "hostRespond" | "pay" | "hostWaitPay";

/**
 * Prazo com contagem (decisão de 22/10/2026): o Host responde em 20 minutos
 * (mesmo dia) ou 24 horas (agendada); o Rider paga em 10 minutos. Ao vencer, a
 * tela se atualiza e a reserva aparece como "Prazo vencido".
 */
export function Deadline({ until, kind, className }: { until: string; kind: DeadlineKind; className?: string }) {
  const t = useTranslations("deadline");
  const format = useFormatter();
  const router = useRouter();
  const end = new Date(until).getTime();
  const [now, setNow] = useState(() => Date.now());
  const refreshed = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);

  const left = end - now;
  useEffect(() => {
    // Venceu: a limpeza do banco roda a cada minuto; atualiza a tela uma vez depois disso.
    if (left <= 0 && !refreshed.current) {
      refreshed.current = true;
      const timer = setTimeout(() => router.refresh(), 70_000);
      return () => clearTimeout(timer);
    }
  }, [left, router]);

  const minutes = Math.max(0, Math.ceil(left / 60_000));
  const leftText =
    minutes < 1 ? t("lessThanMinute") : minutes < 60 ? t("minutes", { count: minutes }) : t("hours", { h: Math.floor(minutes / 60), m: minutes % 60 });
  const sameDay = new Date(end).toDateString() === new Date(now).toDateString();
  const time = format.dateTime(new Date(end), sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const urgent = left < 5 * 60_000;

  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md px-3 py-2 text-sm",
        left <= 0 ? "bg-surface text-hs-black" : urgent ? "bg-pink-soft text-on-pink" : "bg-blue-soft text-on-blue",
        className,
      )}
    >
      <Clock aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{left <= 0 ? t("over") : t(kind, { time, left: leftText })}</span>
    </p>
  );
}
