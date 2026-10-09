import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import QRCode from "qrcode";

import { CheckCircleIcon, KeyIcon, PlusIcon } from "@/components/icons";
import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { AvailabilityToggle } from "@/components/host/availability-toggle";
import { QrLabelDialog } from "@/components/host/qr-label-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { todayInSaoPaulo } from "@/lib/booking";
import { EDIT_INTERVAL_DAYS } from "@/lib/equipment";
import { getEquipment } from "@/lib/equipment-db";
import { editPolicy, listHostListings, type HostListing } from "@/lib/host";
import { riderDailyPrice } from "@/lib/pricing";
import { requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.listings");
  return { title: t("title") };
}

const reviewTone = { pending: "pending", approved: "success", rejected: "error" } as const;

async function ListingCard({ listing, today }: { listing: HostListing; today: string }) {
  const t = await getTranslations("host.listings");
  const format = await getFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });
  const policy = editPolicy(listing, today);
  const approved = listing.review_status === "approved";
  const isPublic = approved && (await getEquipment(listing.id)) !== null;
  const qrSvg = approved ? await QRCode.toString(listing.label_code, { type: "svg", margin: 1 }) : "";

  const editNote = policy.allowed
    ? approved
      ? t("editAllowed", { days: EDIT_INTERVAL_DAYS })
      : null
    : policy.reason === "tooSoon" && policy.nextDate
      ? t("editNextDate", { date: longDate(policy.nextDate) })
      : policy.reason === "editInReview"
        ? t("editInReview")
        : t("inReviewNote");

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex gap-4">
        <EquipmentPhoto type={listing.type} src={listing.photos[0]} className="size-20 shrink-0 rounded-md sm:size-24" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={reviewTone[listing.review_status]}>{t(`review.${listing.review_status}`)}</Badge>
            {listing.edit_in_review ? <Badge tone="info">{t("review.editPending")}</Badge> : null}
          </div>
          <p className="line-clamp-2 text-base font-semibold text-hs-black">{listing.title}</p>
          <p className="text-sm text-muted">
            {listing.area}, {listing.city} · {t("hours", { pickup: listing.pickup_time, return: listing.return_time })}
          </p>
          <p className="text-sm text-hs-black">
            {t.rich("price", {
              host: money(listing.daily_price),
              rider: money(riderDailyPrice(listing.daily_price)),
              strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
            })}
          </p>
        </div>
      </div>

      {listing.review_status === "rejected" && listing.review_reason ? (
        <div className="flex flex-col gap-1 rounded-md border border-error-line bg-error-soft p-3">
          <p className="text-sm font-semibold text-error">{t("rejectedReason")}</p>
          <p className="text-sm text-hs-black">{listing.review_reason}</p>
        </div>
      ) : null}
      {listing.review_status === "pending" ? (
        <p className="rounded-md bg-surface p-3 text-sm text-hs-black">{t("pendingText")}</p>
      ) : null}

      {approved ? <AvailabilityToggle listingId={listing.id} initial={listing.is_available} /> : null}

      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
        {policy.allowed ? (
          <Button asChild variant={listing.review_status === "rejected" ? "primary" : "secondary"}>
            <Link href={`/host/equipment/${listing.id}/edit`}>
              {listing.review_status === "rejected" ? t("fixAndResend") : t("edit")}
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" disabled aria-describedby={`edit-note-${listing.id}`}>
            {t("edit")}
          </Button>
        )}
        {approved ? <QrLabelDialog code={listing.label_code} title={listing.title} qrSvg={qrSvg} /> : null}
        {isPublic ? (
          <Button asChild variant="ghost">
            <Link href={`/equipment/${listing.id}?preview=owner`}>{t("view")}</Link>
          </Button>
        ) : null}
      </div>
      {editNote ? (
        <p id={`edit-note-${listing.id}`} className="-mt-2 text-sm text-muted">
          {editNote}
        </p>
      ) : null}
    </li>
  );
}

/** Meus anúncios (Host). */
export default async function HostListingsPage({ searchParams }: PageProps<"/host/equipment">) {
  // Com a Supabase, só quem entrou na conta (na demonstração, a tela abre direto).
  if (supabaseConfigured()) await requireUser();
  const t = await getTranslations("host.listings");
  const { sent, preview } = await searchParams;
  // PROVISÓRIO até o login existir: ?preview=empty mostra a tela sem anúncios.
  const listings = preview === "empty" ? [] : await listHostListings();
  const today = todayInSaoPaulo();
  const sentKey = sent === "new" || sent === "edit" || sent === "resent" ? sent : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
          <p className="text-base text-muted">{t("subtitle")}</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/host/equipment/new">
            <PlusIcon />
            {t("new")}
          </Link>
        </Button>
      </div>

      {sentKey ? (
        <div role="status" className="flex gap-3 rounded-lg bg-green-soft p-4">
          <CheckCircleIcon className="size-6 shrink-0 text-on-green" />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-on-green">{t(`sent.${sentKey}Title`)}</p>
            <p className="text-sm text-hs-black">{t(`sent.${sentKey}Text`)}</p>
          </div>
        </div>
      ) : null}

      {listings.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center">
          <KeyIcon className="size-10 text-muted" />
          <h2 className="text-base font-semibold text-hs-black">{t("emptyTitle")}</h2>
          <p className="text-sm text-muted">{t("emptyText")}</p>
          <Button asChild>
            <Link href="/host/equipment/new">{t("new")}</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} today={today} />
          ))}
        </ul>
      )}
    </div>
  );
}
