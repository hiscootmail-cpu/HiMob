"use client";

import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";

import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import type { Equipment } from "@/lib/equipment";
import { cn } from "@/lib/utils";

type EquipmentCardProps = {
  item: Equipment;
  /** Distância até a pessoa, só quando ela compartilhou a localização. */
  distanceKm: number | null;
  highlighted?: boolean;
  onHover?: (id: string | null) => void;
};

/** Cartão de anúncio da busca. O cartão inteiro leva ao detalhe do equipamento. */
export function EquipmentCard({ item, distanceKm, highlighted = false, onHover }: EquipmentCardProps) {
  const t = useTranslations("explore");
  const tType = useTranslations("equipmentType");
  const format = useFormatter();
  const price = format.number(item.daily_price, { style: "currency", currency: "BRL" });

  return (
    <Link
      href={`/equipment/${item.id}`}
      onMouseEnter={() => onHover?.(item.id)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(item.id)}
      onBlur={() => onHover?.(null)}
      className={cn(
        "group flex gap-4 rounded-lg border bg-hs-white p-3 text-hs-black transition-colors outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
        highlighted ? "border-hs-black" : "border-line hover:border-hs-black/40",
      )}
    >
      <EquipmentPhoto type={item.type} className="size-24 shrink-0 rounded-md sm:size-28" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-semibold text-hs-black">{item.title}</h3>
          {item.is_available ? null : <Badge tone="neutral">{t("unavailable")}</Badge>}
        </div>
        <p className="truncate text-sm text-muted">
          {tType(item.type)} · {item.area}, {item.city}
        </p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          {item.rating ? (
            <span className="inline-flex items-center gap-1 text-hs-black">
              <StarIcon className="size-4" />
              {format.number(item.rating.average, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}
              <span className="text-muted">({item.rating.count})</span>
            </span>
          ) : (
            <span className="text-muted">{t("noReviews")}</span>
          )}
          {distanceKm !== null ? (
            <span className="text-muted">· {t("distance", { km: format.number(distanceKm, { maximumFractionDigits: 1 }) })}</span>
          ) : null}
          {item.host.verified ? (
            <span className="inline-flex items-center gap-1 text-hs-black">
              · <VerifiedBadgeIcon className="size-4" /> {t("verified")}
            </span>
          ) : null}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-1">
          <p className="text-base font-bold text-hs-black">{t("pricePerDay", { price })}</p>
          <span className="rounded-full bg-hs-green px-3 py-1 text-sm font-semibold text-on-green group-hover:brightness-95">
            {t("reserve")}
          </span>
        </div>
      </div>
    </Link>
  );
}
