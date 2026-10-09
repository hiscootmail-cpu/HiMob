import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { updateListing } from "@/app/host/equipment/actions";
import { ListingForm } from "@/components/host/listing-form";
import { BackLink } from "@/components/rider/back-link";
import { Button } from "@/components/ui/button";
import { todayInSaoPaulo } from "@/lib/booking";
import { EDIT_INTERVAL_DAYS } from "@/lib/equipment";
import { editPolicy, getHostListing } from "@/lib/host";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.edit");
  return { title: t("title") };
}

/** Editar anúncio: uma vez a cada 30 dias; volta para a análise da equipe. */
export default async function EditListingPage({ params }: PageProps<"/host/equipment/[id]/edit">) {
  const { id } = await params;
  const listing = await getHostListing(id);
  if (!listing) notFound();
  const t = await getTranslations("host.edit");
  const format = await getFormatter();
  const policy = editPolicy(listing, todayInSaoPaulo());
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/host/equipment" label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{listing.title}</p>
      </div>

      {policy.allowed ? (
        <>
          {listing.review_status === "rejected" ? (
            <div role="note" className="flex flex-col gap-1 rounded-lg border border-error-line bg-error-soft p-4">
              <p className="text-sm font-semibold text-error">{t("rejectedTitle")}</p>
              <p className="text-sm text-hs-black">{listing.review_reason}</p>
            </div>
          ) : (
            <div role="note" className="flex flex-col gap-1 rounded-lg bg-blue-soft p-4">
              <p className="text-sm font-semibold text-on-blue">{t("ruleTitle", { days: EDIT_INTERVAL_DAYS })}</p>
              <p className="text-sm text-hs-black">{t("ruleText")}</p>
            </div>
          )}
          <ListingForm
            action={updateListing.bind(null, listing.id)}
            mode="edit"
            defaults={{
              type: listing.type,
              title: listing.title,
              description: listing.description,
              daily_price: listing.daily_price,
              city: listing.city,
              area: listing.area,
              pickup_address: listing.pickup_address,
              latitude: listing.latitude,
              longitude: listing.longitude,
              pickup_time: listing.pickup_time,
              return_time: listing.return_time,
            }}
          />
        </>
      ) : (
        <div className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-6">
          <p className="text-base text-hs-black">
            {policy.reason === "tooSoon" && policy.nextDate
              ? t("blockedTooSoon", { days: EDIT_INTERVAL_DAYS, date: longDate(policy.nextDate) })
              : t(policy.reason === "inReview" ? "blockedInReview" : "blockedEditInReview")}
          </p>
          <Button asChild variant="outline" className="w-full sm:w-fit">
            <Link href="/host/equipment">{t("back")}</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
