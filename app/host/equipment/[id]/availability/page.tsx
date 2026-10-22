import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AvailabilityEditor } from "@/components/host/availability-editor";
import { BackLink } from "@/components/rider/back-link";
import { listingDays } from "@/lib/availability";
import { todayInSaoPaulo } from "@/lib/booking";
import { getHostListing } from "@/lib/host";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";


export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.availability");
  return { title: t("title") };
}

/** Dias disponíveis do equipamento: o Host libera os dias em que vai alugar (decisão de 20/10/2026). */
export default async function AvailabilityPage({ params }: PageProps<"/host/equipment/[id]/availability">) {
  if (supabaseConfigured()) await requireUser();
  const { id } = await params;
  const listing = await getHostListing(id);
  if (!listing) notFound();
  const t = await getTranslations("host.availability");
  const today = todayInSaoPaulo();
  const { available, booked, weekly } = await listingDays(id, today);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/host/equipment" label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{listing.title}</p>
      </div>
      <p className="rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">
        {t("help", { from: listing.pickup_time, until: listing.return_time })}
      </p>
      <AvailabilityEditor listingId={id} today={today} initial={available} booked={booked} weekly={weekly} />
    </div>
  );
}
