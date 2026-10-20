/*
 * Duração do aluguel em texto ("3 horas", "1 dia e 2 horas", "1 hora e 30 min").
 * Recebe a função de tradução do grupo "duration" (PT/EN).
 */
type DurationT = (key: "days" | "hours" | "minutes" | "join", values: Record<string, string | number>) => string;

export function durationText(t: DurationT, hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (24 * 60));
  const restHours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes % 60;
  const parts = [
    days ? t("days", { count: days }) : null,
    restHours ? t("hours", { count: restHours }) : null,
    minutes ? t("minutes", { count: minutes }) : null,
  ].filter((p): p is string => Boolean(p));
  if (parts.length <= 1) return parts[0] ?? t("hours", { count: 0 });
  return t("join", { first: parts.slice(0, -1).join(", "), last: parts.at(-1)! });
}
