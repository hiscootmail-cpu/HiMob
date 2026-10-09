import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { decideIdentity, decideListing } from "@/app/admin/actions";
import { DecisionForm } from "@/app/admin/decision-form";
import { DocumentDialog } from "@/app/admin/document-dialog";
import { EquipmentPhoto } from "@/components/equipment/equipment-photo";
import { CheckCircleIcon, ShieldAdminIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { listIdentityQueue, listListingQueue, type AdminListing } from "@/lib/admin";
import { MAX_DOCUMENT_REJECTIONS } from "@/lib/identity";
import { riderDailyPrice } from "@/lib/pricing";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("title") };
}

const TABS = ["listings", "edits", "identity"] as const;
type Tab = (typeof TABS)[number];

async function ListingItem({ item }: { item: AdminListing }) {
  const t = await getTranslations("admin");
  const tType = await getTranslations("equipmentType");
  const format = await getFormatter();
  const money = (v: number) => format.number(v, { style: "currency", currency: "BRL" });

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex gap-4">
        <EquipmentPhoto type={item.type} className="size-20 shrink-0 rounded-md" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-xs text-muted">
            {t("sent", { when: format.relativeTime(new Date(item.sent_at), new Date()) })}
          </p>
          <p className="text-base font-semibold text-hs-black">{item.title}</p>
          <p className="text-sm text-muted">
            {tType(item.type)} · {item.area}, {item.city} · {t("photos", { count: item.photos_count })}
          </p>
          <p className="text-sm text-hs-black">
            {t("hostLabel")}{" "}
            <Link href={`/profile/${item.host.id}`} className="font-semibold underline underline-offset-2">
              {item.host.name}
            </Link>
            {item.host.verified ? ` · ${t("verified")}` : ` · ${t("notVerified")}`}
          </p>
          <p className="text-sm text-hs-black">
            {t("price", { host: money(item.daily_price), rider: money(riderDailyPrice(item.daily_price)) })}
          </p>
        </div>
      </div>
      <p className="rounded-md bg-surface p-3 text-sm text-hs-black">{item.description}</p>
      {item.changes?.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-hs-black">{t("changesTitle")}</p>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-muted">
                <th scope="col" className="py-1.5 pr-3 font-medium">{t("changeField")}</th>
                <th scope="col" className="py-1.5 pr-3 font-medium">{t("changeBefore")}</th>
                <th scope="col" className="py-1.5 font-medium">{t("changeAfter")}</th>
              </tr>
            </thead>
            <tbody>
              {item.changes.map((c) => (
                <tr key={c.field} className="border-b border-line text-hs-black last:border-0">
                  <th scope="row" className="py-1.5 pr-3 font-medium">{t(`fields.${c.field}`)}</th>
                  <td className="py-1.5 pr-3">{c.before}</td>
                  <td className="py-1.5 font-semibold">{c.after}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted">{t("editStaysLive")}</p>
        </div>
      ) : null}
      <DecisionForm id={item.id} action={decideListing.bind(null, item.id)} />
    </li>
  );
}

/** Painel do administrador: só a equipe entra (o servidor confere). */
export default async function AdminPage({ searchParams }: PageProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");

  const t = await getTranslations("admin");
  const format = await getFormatter();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "listings";
  const [listingQueue, identityQueue] = await Promise.all([listListingQueue(), listIdentityQueue()]);
  const newListings = listingQueue.filter((l) => l.kind === "new");
  const edits = listingQueue.filter((l) => l.kind === "edit");
  const counts: Record<Tab, number> = { listings: newListings.length, edits: edits.length, identity: identityQueue.length };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex items-center gap-3">
        <ShieldAdminIcon className="size-8" />
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
          <p className="text-base text-muted">{t("subtitle")}</p>
        </div>
      </div>

      <nav aria-label={t("queuesLabel")} className="flex flex-col gap-1 rounded-lg border border-line p-1 sm:flex-row sm:rounded-full">
        {TABS.map((key) => (
          <Link
            key={key}
            href={`/admin?tab=${key}`}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
              tab === key ? "bg-hs-black text-hs-white" : "text-hs-black hover:bg-surface",
            )}
          >
            {t(`tabs.${key}`)}
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
      <p className="text-sm text-muted">{t("oldestFirst")}</p>

      {counts[tab] === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center">
          <CheckCircleIcon className="size-10 text-on-green" />
          <p className="text-base font-semibold text-hs-black">{t("emptyTitle")}</p>
        </div>
      ) : tab === "identity" ? (
        <ul className="flex flex-col gap-4">
          {identityQueue.map((item) => {
            const blocks = item.kind === "document" && item.rejections + 1 >= MAX_DOCUMENT_REJECTIONS;
            return (
              <li key={item.id} className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-xs text-muted">
                      {t("sent", { when: format.relativeTime(new Date(item.sent_at), new Date()) })}
                    </p>
                    <p className="text-base font-semibold text-hs-black">{item.full_name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={item.kind === "letter" ? "highlight" : "info"}>
                        {item.kind === "letter" ? t("identity.letter") : t("identity.document")}
                      </Badge>
                      {item.rejections ? (
                        <Badge tone="pending">{t("identity.rejections", { count: item.rejections })}</Badge>
                      ) : null}
                    </div>
                  </div>
                  <DocumentDialog kind={item.kind} name={item.full_name} />
                </div>
                <p className="text-sm text-hs-black">
                  {item.kind === "letter" ? t("identity.letterHelp") : t("identity.documentHelp")}
                </p>
                {blocks ? (
                  <p className="rounded-md border border-error-line bg-error-soft p-3 text-sm text-error">{t("identity.lastChance")}</p>
                ) : null}
                <DecisionForm id={item.id} action={decideIdentity.bind(null, item.id)} rejectBlocks={blocks} />
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-4">
          {(tab === "listings" ? newListings : edits).map((item) => (
            <ListingItem key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
