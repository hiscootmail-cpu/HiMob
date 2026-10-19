import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PlacesSection } from "@/components/scoot-world/places-section";
import { WorldHeading } from "@/components/scoot-world/world-heading";
import { listWorldPlaces } from "@/lib/scoot-world";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scootWorld.places");
  return { title: t("title"), description: t("subtitle") };
}

/** Lojas parceiras e oficinas credenciadas (campos básicos; o resto vem depois). */
export default async function WorldPlacesPage() {
  const t = await getTranslations("scootWorld.places");
  const places = (await listWorldPlaces()).filter((p) => p.active);

  return (
    <div className="flex flex-col gap-6">
      <WorldHeading title={t("title")} subtitle={t("subtitle")} />
      <PlacesSection places={places} />
    </div>
  );
}
