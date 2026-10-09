import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { EquipmentCard } from "@/components/equipment/equipment-card";
import { CheckCircleIcon, KeyIcon, MapPinIcon, StarIcon, VerifiedBadgeIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getPublicProfile } from "@/lib/profiles";
import { getCurrentUser } from "@/lib/session";

export async function generateMetadata({ params }: PageProps<"/profile/[id]">): Promise<Metadata> {
  const { id } = await params;
  const data = await getPublicProfile(id);
  return { title: data?.profile.name };
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

/** Perfil público: nome, selos, avaliações e anúncios (se for Host). Sem dados de contato. */
export default async function PublicProfilePage({ params, searchParams }: PageProps<"/profile/[id]">) {
  const { id } = await params;
  const { saved } = await searchParams;
  const [data, user] = await Promise.all([getPublicProfile(id), getCurrentUser()]);
  if (!data) notFound();
  const { profile, listings } = data;
  const t = await getTranslations("profile");
  const format = await getFormatter();
  const isMe = user?.id === profile.id;
  const rating = (r: { average: number; count: number } | null) =>
    r ? `${format.number(r.average, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} (${t("reviewsCount", { count: r.count })})` : t("noRatingYet");

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-8 sm:px-6">
      {isMe && saved === "1" ? (
        <p role="status" className="flex items-center gap-2 rounded-md bg-green-soft px-4 py-3 text-sm font-semibold text-on-green">
          <CheckCircleIcon className="size-5" />
          {t("saved")}
        </p>
      ) : null}

      <section className="flex flex-col gap-5 rounded-lg border border-line bg-hs-white p-5 sm:flex-row sm:items-center sm:p-6">
        <span aria-hidden className="flex size-20 shrink-0 items-center justify-center rounded-full bg-purple-soft text-2xl font-bold text-on-purple">
          {initials(profile.name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{profile.name}</h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPinIcon className="size-4" />
              {profile.city}
            </span>
            <span>{t("memberSince", { year: profile.member_since })}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {profile.verified ? (
              <Badge tone="info">
                <VerifiedBadgeIcon />
                {t("verified")}
              </Badge>
            ) : (
              <Badge tone="neutral">{t("notVerified")}</Badge>
            )}
            {profile.is_host ? (
              <Badge tone="success">
                <KeyIcon />
                {t("host")}
              </Badge>
            ) : null}
          </div>
        </div>
        {isMe ? (
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link href="/profile/edit">{t("edit")}</Link>
          </Button>
        ) : null}
      </section>

      <section aria-labelledby="ratings-title" className="flex flex-col gap-3">
        <h2 id="ratings-title" className="text-lg font-semibold text-hs-black">
          {t("ratingsTitle")}
        </h2>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {profile.is_host ? (
            <div className="flex flex-col gap-1 rounded-lg border border-line p-4">
              <dt className="text-sm text-muted">{t("asHost")}</dt>
              <dd className="flex items-center gap-1.5 text-base font-semibold text-hs-black">
                <StarIcon className="size-5" />
                {rating(profile.host_rating)}
              </dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-1 rounded-lg border border-line p-4">
            <dt className="text-sm text-muted">{t("asRider")}</dt>
            <dd className="flex items-center gap-1.5 text-base font-semibold text-hs-black">
              <StarIcon className="size-5" />
              {rating(profile.rider_rating)}
            </dd>
          </div>
        </dl>
        {profile.reviews.length ? (
          <ul className="flex flex-col gap-3">
            {profile.reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 rounded-lg bg-surface p-4">
                <p className="flex flex-wrap items-center gap-x-2 text-sm text-hs-black">
                  <span className="font-semibold">{r.author}</span>
                  <span className="text-muted">
                    · {t(r.as === "host" ? "reviewAsHost" : "reviewAsRider")} ·{" "}
                    {format.dateTime(new Date(`${r.date}T12:00:00Z`), { month: "long", year: "numeric", timeZone: "UTC" })}
                  </span>
                </p>
                <p className="flex items-center gap-1 text-sm text-hs-black" aria-label={t("starsOf5", { count: r.rating })}>
                  {Array.from({ length: r.rating }, (_, i) => (
                    <StarIcon key={i} className="size-4" />
                  ))}
                </p>
                <p className="text-base text-hs-black">{r.comment}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t("noReviews")}</p>
        )}
      </section>

      {profile.is_host ? (
        <section aria-labelledby="listings-title" className="flex flex-col gap-3">
          <h2 id="listings-title" className="text-lg font-semibold text-hs-black">
            {t("listingsTitle")}
          </h2>
          {listings.length ? (
            <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {listings.map((item) => (
                <li key={item.id}>
                  <EquipmentCard item={item} distanceKm={null} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("noListings")}</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
