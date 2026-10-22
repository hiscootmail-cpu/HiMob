"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { CityField } from "@/components/city-field";
import { cityValue, type ChosenCity } from "@/lib/br-cities";
import { riderDailyPrice } from "@/lib/pricing";
import { cityDemand, type CityDemand } from "./actions";

const inputClass =
  "h-11 w-full rounded-md border border-line bg-hs-white px-4 text-base text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25";

/**
 * Simulador de ganhos (decisão de 22/10/2026): quanto o Host pode ganhar com
 * mais equipamentos e em outras cidades. Estimativa simples: equipamentos ×
 * diária × dias alugados por mês. O Host recebe a diária inteira (a taxa de 15%
 * é paga pelo Rider por cima).
 */
export function Simulator({ defaults }: { defaults: { equipment: number; daily: number; city: ChosenCity | null } }) {
  const t = useTranslations("host.earnings.sim");
  const format = useFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const [equipment, setEquipment] = useState(String(defaults.equipment));
  const [daily, setDaily] = useState(String(defaults.daily));
  const [days, setDays] = useState(8);
  const [demand, setDemand] = useState<{ city: ChosenCity; data: CityDemand | null } | null>(null);
  const [loading, start] = useTransition();

  const n = Math.min(100, Math.max(0, Math.floor(Number(equipment) || 0)));
  const price = Math.min(999, Math.max(0, Number(daily.replace(",", ".")) || 0));
  const monthly = n * price * days;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-hs-white p-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-hs-black">
          {t("equipment")}
          <input type="number" inputMode="numeric" min={1} max={100} value={equipment} onChange={(e) => setEquipment(e.currentTarget.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-hs-black">
          {t("daily")}
          <input inputMode="decimal" value={daily} onChange={(e) => setDaily(e.currentTarget.value)} className={inputClass} />
          <span className="text-xs font-normal text-muted">{t("riderPays", { value: money(riderDailyPrice(price)) })}</span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium text-hs-black sm:col-span-2">
          {t("days", { days })}
          <input type="range" min={0} max={30} value={days} onChange={(e) => setDays(Number(e.currentTarget.value))} className="accent-hs-green" />
          <span className="text-xs font-normal text-muted">{t("daysHint")}</span>
        </label>
        <div className="sm:col-span-2">
          <CityField
            name="simCity"
            label={t("city")}
            hint={t("cityHint")}
            defaultValue={defaults.city}
            onChange={(city) => {
              if (!city) {
                setDemand(null);
                return;
              }
              start(async () => setDemand({ city, data: await cityDemand(cityValue(city)) }));
            }}
          />
        </div>
      </div>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li className="flex flex-col gap-1 rounded-lg border border-line bg-hs-white p-4">
          <span className="text-sm text-muted">{t("perDay")}</span>
          <span className="text-2xl font-bold text-hs-black">{money(n * price)}</span>
        </li>
        <li className="flex flex-col gap-1 rounded-lg border-2 border-hs-green bg-green-soft p-4">
          <span className="text-sm text-on-green">{t("perMonth")}</span>
          <span className="text-2xl font-bold text-on-green">{money(monthly)}</span>
        </li>
        <li className="flex flex-col gap-1 rounded-lg border border-line bg-hs-white p-4">
          <span className="text-sm text-muted">{t("perYear")}</span>
          <span className="text-2xl font-bold text-hs-black">{money(monthly * 12)}</span>
        </li>
      </ul>

      {loading ? <p className="text-sm text-muted">{t("loading")}</p> : null}
      {demand && !loading ? (
        <section aria-live="polite" className="flex flex-col gap-2 rounded-lg bg-blue-soft p-4 text-sm text-hs-black">
          <h2 className="text-base font-semibold text-on-blue">{t("demandTitle", { city: `${demand.city.city} - ${demand.city.uf}` })}</h2>
          {demand.data ? (
            <ul className="flex list-disc flex-col gap-1 pl-5">
              <li>{t("trips", { count: demand.data.trips })}</li>
              <li>{demand.data.equipment ? t("equipmentThere", { count: demand.data.equipment }) : t("noEquipment")}</li>
              {demand.data.avgDaily ? <li>{t("avgDaily", { value: money(demand.data.avgDaily) })}</li> : null}
            </ul>
          ) : (
            <p>{t("noData")}</p>
          )}
        </section>
      ) : null}

      <p className="text-xs text-muted">{t("disclaimer")}</p>
    </div>
  );
}
