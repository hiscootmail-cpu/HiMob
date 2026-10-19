import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { ItemControls, PlaceForm, ProductForm, VideoForm } from "@/app/admin/scoot-world/world-forms";
import { MapPinIcon } from "@/components/icons";
import { BackLink } from "@/components/rider/back-link";
import { ProductPhoto } from "@/components/scoot-world/product-photo";
import { Badge } from "@/components/ui/badge";
import { formatPhone, listWorldPlaces, listWorldProducts, listWorldVideos, youtubeThumbnail } from "@/lib/scoot-world";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminWorld");
  return { title: t("title") };
}

const TABS = ["store", "tv", "places"] as const;
type Tab = (typeof TABS)[number];

/** Painel da equipe: cadastrar produtos, vídeos da HiTV, lojas parceiras e oficinas. */
export default async function AdminWorldPage({ searchParams }: PageProps<"/admin/scoot-world">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");

  const t = await getTranslations("adminWorld");
  const tWorld = await getTranslations("scootWorld");
  const format = await getFormatter();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "store";
  const [products, videos, places] = await Promise.all([listWorldProducts(), listWorldVideos(), listWorldPlaces()]);
  const counts: Record<Tab, number> = { store: products.length, tv: videos.length, places: places.length };
  const hiddenBadge = <Badge tone="pending">{t("hiddenBadge")}</Badge>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/admin" label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">
          {t("subtitle")}{" "}
          <Link href="/scoot-world" className="font-semibold text-hs-black underline underline-offset-2">
            {t("seePublic")}
          </Link>
        </p>
      </div>

      <nav aria-label={t("tabsLabel")} className="flex flex-col gap-1 rounded-lg border border-line p-1 sm:flex-row sm:rounded-full">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/admin/scoot-world?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
              tab === key ? "bg-hs-black text-hs-white" : "text-hs-black hover:bg-surface",
            )}
          >
            {tWorld(`tabs.${key}`)}
            <span
              className={cn(
                "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs",
                tab === key ? "bg-hs-white text-hs-black" : "bg-surface text-hs-black",
              )}
            >
              {counts[key]}
            </span>
          </Link>
        ))}
      </nav>

      {tab === "store" ? <ProductForm /> : tab === "tv" ? <VideoForm /> : <PlaceForm />}

      {counts[tab] === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-base text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tab === "store"
            ? products.map((item) => (
                <li key={item.id} className="flex gap-4 rounded-lg border border-line bg-hs-white p-4">
                  <ProductPhoto src={item.photo} className="size-20 shrink-0 rounded-md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-hs-black">{item.name}</p>
                      {item.active ? null : hiddenBadge}
                    </div>
                    <p className="text-sm font-semibold text-hs-black">{format.number(item.price, { style: "currency", currency: "BRL" })}</p>
                    <ItemControls table="world_products" id={item.id} name={item.name} active={item.active} />
                  </div>
                </li>
              ))
            : tab === "tv"
              ? videos.map((item) => (
                  <li key={item.id} className="flex gap-4 rounded-lg border border-line bg-hs-white p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={youtubeThumbnail(item.youtube_id)} alt="" loading="lazy" className="aspect-video w-32 shrink-0 rounded-md bg-hs-black object-cover" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-hs-black">{item.title}</p>
                        {item.active ? null : hiddenBadge}
                      </div>
                      <ItemControls table="world_videos" id={item.id} name={item.title} active={item.active} />
                    </div>
                  </li>
                ))
              : places.map((item) => (
                  <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-line bg-hs-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={item.kind === "workshop" ? "success" : "info"}>{tWorld(`places.kind.${item.kind}`)}</Badge>
                      {item.active ? null : hiddenBadge}
                    </div>
                    <p className="text-base font-semibold text-hs-black">{item.name}</p>
                    <p className="flex items-start gap-2 text-sm text-hs-black">
                      <MapPinIcon className="mt-0.5 size-4 shrink-0" />
                      {item.address} · {item.city}
                    </p>
                    <p className="text-sm text-muted">
                      {[item.phone ? formatPhone(item.phone) : null, item.latitude === null ? t("places.noLocation") : null].filter(Boolean).join(" · ")}
                    </p>
                    <ItemControls table="world_places" id={item.id} name={item.name} active={item.active} />
                  </li>
                ))}
        </ul>
      )}
    </div>
  );
}
