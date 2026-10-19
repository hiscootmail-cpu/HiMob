import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { ItemControls, PlaceForm, ProductForm, RefundForm, ShipForm, ShippingForm, SizesForm, StockForm, VideoForm } from "@/app/admin/scoot-world/world-forms";
import { MapPinIcon } from "@/components/icons";
import { BackLink } from "@/components/rider/back-link";
import { ProductPhoto } from "@/components/scoot-world/product-photo";
import { Badge } from "@/components/ui/badge";
import {
  formatCep,
  formatPhone,
  listShippingRates,
  listStoreOrders,
  listWorldPlaces,
  listWorldProducts,
  listWorldVideos,
  youtubeThumbnail,
  type StoreOrder,
} from "@/lib/scoot-world";
import { getCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminWorld");
  return { title: t("title") };
}

const TABS = ["orders", "store", "shipping", "tv", "places"] as const;
const ORDER_TONES = { pending: "pending", paid: "highlight", shipped: "success", canceled: "neutral", refunded: "neutral" } as const;
type Tab = (typeof TABS)[number];

/** Um pedido da loja, com os dados de entrega e as ações da equipe. */
async function OrderItem({ order }: { order: StoreOrder }) {
  const t = await getTranslations("adminWorld.orders");
  const tStatus = await getTranslations("scootWorld.order.status");
  const format = await getFormatter();
  const money = (v: number) => format.number(v, { style: "currency", currency: "BRL" });

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={ORDER_TONES[order.status]}>{tStatus(order.status)}</Badge>
        <p className="font-mono text-sm font-semibold text-hs-black">{order.code}</p>
        <p className="text-xs text-muted">{format.dateTime(new Date(order.created_at), { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" })}</p>
      </div>
      <ul className="flex flex-col gap-1 text-sm text-hs-black">
        {order.items.map((item) => (
          <li key={`${item.name}-${item.size ?? ""}`}>
            {item.quantity} x {item.name}
            {item.size ? <span className="font-semibold"> · {t("size", { size: item.size })}</span> : null} · {money(item.price * item.quantity)}
          </li>
        ))}
      </ul>
      <p className="text-sm text-hs-black">
        {t("totals", { shipping: money(order.shipping), total: money(order.total) })}
      </p>
      <div className="rounded-md bg-surface p-3 text-sm text-hs-black">
        <p className="font-semibold">{order.buyer_name}</p>
        <p>
          {order.buyer_email} · {formatPhone(order.buyer_phone)} · CPF {order.buyer_cpf}
        </p>
        <p>
          {order.street}, {order.number}
          {order.complement ? ` - ${order.complement}` : ""} · {order.district} · {order.city}/{order.state} · {formatCep(order.cep)}
        </p>
      </div>
      {order.tracking_code ? <p className="text-sm text-hs-black">{t("trackingShown", { code: order.tracking_code })}</p> : null}
      {order.status_reason ? <p className="text-sm text-muted">{order.status_reason}</p> : null}
      {order.status === "paid" ? (
        <div className="flex flex-col gap-2">
          <ShipForm id={order.id} />
          <RefundForm id={order.id} code={order.code} />
        </div>
      ) : null}
    </li>
  );
}

/** Painel da equipe: pedidos, produtos com estoque, frete, vídeos da HiTV, lojas parceiras e oficinas. */
export default async function AdminWorldPage({ searchParams }: PageProps<"/admin/scoot-world">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");

  const t = await getTranslations("adminWorld");
  const tWorld = await getTranslations("scootWorld");
  const format = await getFormatter();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "orders";
  const [products, videos, places, rates, orders] = await Promise.all([
    listWorldProducts(),
    listWorldVideos(),
    listWorldPlaces(),
    listShippingRates(),
    listStoreOrders(),
  ]);
  // Pedidos: o número na aba é o que espera a equipe (pagos e ainda não enviados).
  const counts: Record<Tab, number> = {
    orders: orders.filter((o) => o.status === "paid").length,
    store: products.length,
    shipping: rates.length,
    tv: videos.length,
    places: places.length,
  };
  const listed: Record<Tab, number> = { ...counts, orders: orders.length };
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
              "flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-semibold whitespace-nowrap outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
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

      {tab === "store" ? <ProductForm /> : tab === "shipping" ? <ShippingForm /> : tab === "tv" ? <VideoForm /> : tab === "places" ? <PlaceForm /> : null}

      {listed[tab] === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-base text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tab === "orders"
            ? orders.map((order) => <OrderItem key={order.id} order={order} />)
            : tab === "shipping"
            ? rates.map((rate) => (
                <li key={rate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-hs-white p-4">
                  <p className="text-base text-hs-black">
                    <span className="font-semibold">{rate.city ? `${rate.city}/${rate.state}` : t("shipping.wholeState", { state: rate.state })}</span>
                    {" · "}
                    {format.number(rate.price, { style: "currency", currency: "BRL" })}
                  </p>
                  <ItemControls table="world_shipping_rates" id={rate.id} name={rate.city ? `${rate.city}/${rate.state}` : rate.state} />
                </li>
              ))
            : tab === "store"
            ? products.map((item) => (
                <li key={item.id} className="flex gap-4 rounded-lg border border-line bg-hs-white p-4">
                  <ProductPhoto src={item.photo} className="size-20 shrink-0 rounded-md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-hs-black">{item.name}</p>
                      {item.active ? null : hiddenBadge}
                    </div>
                    <p className="text-sm font-semibold text-hs-black">
                      {format.number(item.price, { style: "currency", currency: "BRL" })} ·{" "}
                      {item.stock > 0 ? t("store.stockShown", { count: item.stock }) : t("store.soldOut")}
                    </p>
                    <StockForm id={item.id} stock={item.stock} />
                    <SizesForm id={item.id} sizes={item.sizes} />
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
