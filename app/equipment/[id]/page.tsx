import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { MapPinIcon, StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { todayInSaoPaulo } from "@/lib/booking";
import { getEquipment } from "@/lib/equipment";
import { BookingPanel } from "./booking-panel";

export async function generateMetadata({ params }: PageProps<"/equipment/[id]">): Promise<Metadata> {
  const { id } = await params;
  const equipment = await getEquipment(id);
  return { title: equipment?.title };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Detalhe do equipamento, com o quadro de reserva embutido. */
export default async function EquipmentPage({ params, searchParams }: PageProps<"/equipment/[id]">) {
  const { id } = await params;
  const { preview } = await searchParams;
  const equipment = await getEquipment(id);
  if (!equipment) notFound();

  const t = await getTranslations("equipment");
  const tType = await getTranslations("equipmentType");
  const format = await getFormatter();
  const price = format.number(equipment.daily_price, { style: "currency", currency: "BRL" });

  // PROVISÓRIO até o login existir: ?preview=owner mostra a tela como o dono do anúncio vê.
  const isOwner = preview === "owner";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-4 pb-28 sm:px-6 md:pb-12">
      <Link
        href="/"
        className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-medium text-hs-black outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t("backToSearch")}
      </Link>

      <EquipmentPhoto type={equipment.type} className="h-56 w-full rounded-lg md:h-80" />

      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-6">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="info">{tType(equipment.type)}</Badge>
              {equipment.is_available ? null : <Badge tone="neutral">{t("unavailable")}</Badge>}
            </div>
            <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{equipment.title}</h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
              {equipment.rating ? (
                <span className="inline-flex items-center gap-1 text-hs-black">
                  <StarIcon className="size-4" />
                  {format.number(equipment.rating.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                  <span className="text-muted">{t("reviewCount", { count: equipment.rating.count })}</span>
                </span>
              ) : (
                <span className="text-muted">{t("noReviews")}</span>
              )}
              <span className="text-muted">·</span>
              <span className="inline-flex items-center gap-1 text-muted">
                <MapPinIcon className="size-4" />
                {equipment.area}, {equipment.city}
              </span>
            </p>
          </header>

          <Link
            href={`/profile/${equipment.host_id}`}
            className="flex items-center gap-3 rounded-lg border border-line p-4 text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-purple-soft text-base font-bold text-on-purple">
              {initials(equipment.host.full_name)}
            </span>
            <span className="flex flex-col">
              <span className="flex items-center gap-1 text-base font-semibold text-hs-black">
                {t("hostedBy", { name: equipment.host.full_name })}
                {equipment.host.verified ? <VerifiedBadgeIcon className="size-5" title={t("verifiedHost")} /> : null}
              </span>
              <span className="text-sm text-muted">{t("hostSince", { year: equipment.host.host_since })}</span>
            </span>
          </Link>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-hs-black">{t("about")}</h2>
            <p className="text-base whitespace-pre-line text-hs-black">{equipment.description}</p>
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-hs-black">{t("whereTitle")}</h2>
            <p className="text-base text-hs-black">
              {equipment.area}, {equipment.city}
            </p>
            <p className="text-sm text-muted">{t("whereNote")}</p>
          </section>
        </div>

        <aside id="reservar" aria-label={t("bookingLabel")} className="scroll-mt-20">
          <div className="rounded-lg border border-line bg-hs-white p-5 shadow-sm md:sticky md:top-20">
            <BookingPanel equipment={equipment} today={todayInSaoPaulo()} isOwner={isOwner} />
          </div>
        </aside>
      </div>

      {/* Celular: barra fixa com preço e atalho para o quadro de reserva. */}
      {isOwner ? null : (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-hs-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between gap-3">
            <p className="text-hs-black">
              <span className="text-lg font-bold text-hs-black">{price}</span>
              <span className="text-sm text-muted"> {t("perDay")}</span>
            </p>
            <a
              href="#reservar"
              className="inline-flex h-11 items-center rounded-full bg-hs-green px-6 text-base font-semibold text-on-green outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40"
            >
              {equipment.is_available ? t("reserve") : t("seeOptions")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
