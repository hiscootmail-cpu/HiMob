import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { PixPanel } from "@/app/scoot-world/orders/[id]/pix-panel";
import { CheckCircleIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { formatCep } from "@/lib/scoot-world-rules";
import { getStoreOrder } from "@/lib/store-orders";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("scootWorld.order");
  // Página com dados pessoais: fora das buscas.
  return { title: t("title"), robots: { index: false, follow: false } };
}

const TONES = { pending: "pending", paid: "info", shipped: "success", canceled: "neutral", refunded: "neutral" } as const;

/** Página do pedido. Quem comprou sem conta acompanha pelo link secreto. */
export default async function OrderPage({ params, searchParams }: PageProps<"/scoot-world/orders/[id]">) {
  const { id } = await params;
  const { k } = await searchParams;
  const order = await getStoreOrder(id, typeof k === "string" ? k : "");
  if (!order) notFound();
  const t = await getTranslations("scootWorld.order");
  const format = await getFormatter();
  const money = (v: number) => format.number(v, { style: "currency", currency: "BRL" });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Badge tone={TONES[order.status]}>{t(`status.${order.status}`)}</Badge>
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("heading", { code: order.code })}</h1>
        <p className="text-base text-muted">{t(`statusText.${order.status}`)}</p>
      </div>

      {order.status === "pending" && order.pix_code ? (
        <PixPanel id={order.id} token={String(k)} code={order.pix_code} qr={order.pix_qr_base64} />
      ) : null}

      {order.status === "paid" || order.status === "shipped" ? (
        <p className="flex items-center gap-2 rounded-md bg-green-soft px-4 py-3 text-sm font-semibold text-on-green">
          <CheckCircleIcon className="size-5" />
          {t("paidNote")}
        </p>
      ) : null}
      {order.tracking_code ? (
        <p className="rounded-md bg-blue-soft px-4 py-3 text-sm text-on-blue">
          {t("tracking")} <span className="font-mono font-semibold">{order.tracking_code}</span>
        </p>
      ) : null}
      {order.status_reason && order.status === "refunded" ? (
        <p className="rounded-md bg-surface px-4 py-3 text-sm text-hs-black">{t("reason", { reason: order.status_reason })}</p>
      ) : null}

      <p role="note" className="rounded-md border border-line px-4 py-3 text-sm text-hs-black">
        {t("saveLink")}
      </p>

      <section aria-labelledby="order-items" className="flex flex-col gap-3 rounded-lg border border-line bg-hs-white p-5">
        <h2 id="order-items" className="text-lg font-bold text-hs-black">{t("itemsTitle")}</h2>
        <ul className="flex flex-col gap-2 text-sm text-hs-black">
          {order.items.map((item) => (
            <li key={`${item.name}-${item.size ?? ""}`} className="flex justify-between gap-4">
              <span>
                {item.quantity} x {item.name}
                {item.size ? ` · ${t("size", { size: item.size })}` : ""}
              </span>
              <span>{money(item.price * item.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="flex flex-col gap-1 border-t border-line pt-3 text-sm text-hs-black">
          <div className="flex justify-between gap-4">
            <dt>{t("subtotal")}</dt>
            <dd>{money(order.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt>{t("shipping")}</dt>
            <dd>{money(order.shipping)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-base font-bold">
            <dt>{t("total")}</dt>
            <dd>{money(order.total)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="order-address" className="flex flex-col gap-1 rounded-lg border border-line bg-hs-white p-5 text-sm text-hs-black">
        <h2 id="order-address" className="mb-1 text-lg font-bold text-hs-black">{t("addressTitle")}</h2>
        <p>{order.buyer_name}</p>
        <p>
          {order.street}, {order.number}
          {order.complement ? ` - ${order.complement}` : ""}
        </p>
        <p>
          {order.district} · {order.city}/{order.state} · {formatCep(order.cep)}
        </p>
      </section>
    </div>
  );
}
