"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { cartProducts, placeOrder, quoteShipping, type CartProduct } from "@/app/scoot-world/cart/actions";
import { unitsOf, useCart } from "@/components/scoot-world/cart-store";
import { ProductPhoto } from "@/components/scoot-world/product-photo";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { BR_STATES, WORLD_LIMITS, type BuyerData, type CheckoutField } from "@/lib/scoot-world-rules";

const NO_PRODUCTS: CartProduct[] = [];

const EMPTY_BUYER: BuyerData = {
  name: "", email: "", phone: "", cpf: "", cep: "", street: "", number: "", complement: "", district: "", city: "", state: "",
};

type Props = {
  /** O pagamento por PIX já está configurado? */
  ready: boolean;
  prefill: Partial<BuyerData>;
};

/** Itens do carrinho, dados de entrega, frete e "Pagar com PIX". */
export function CartCheckout({ ready, prefill }: Props) {
  const t = useTranslations("scootWorld.cart");
  const format = useFormatter();
  const router = useRouter();
  const cart = useCart();
  const money = (v: number) => format.number(v, { style: "currency", currency: "BRL" });

  const [fetched, setFetched] = useState<{ list: CartProduct[] } | null>(null);
  const [buyer, setBuyer] = useState<BuyerData>({ ...EMPTY_BUYER, ...prefill });
  const [shipping, setShipping] = useState<{ key: string; price: number | null } | null>(null);
  const [badFields, setBadFields] = useState<CheckoutField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Busca preço e estoque atuais dos produtos do carrinho (de novo quando o carrinho muda).
  const ids = [...new Set(cart.lines.map((l) => l.id))].join(",");
  const [refetch, setRefetch] = useState(0);
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    cartProducts(ids.split(",")).then((list) => alive && setFetched({ list }));
    return () => {
      alive = false;
    };
  }, [ids, refetch]);
  // Enquanto busca de novo, segue mostrando a lista anterior (as linhas vêm do carrinho).
  const products = !ids ? NO_PRODUCTS : (fetched?.list ?? null);

  // Frete: calcula quando estado e cidade estão preenchidos.
  const regionKey = `${buyer.state}|${buyer.city.trim().toLowerCase()}`;
  useEffect(() => {
    if (!buyer.state || buyer.city.trim().length < 2) return;
    let alive = true;
    const timer = setTimeout(() => {
      quoteShipping(buyer.state, buyer.city).then((price) => alive && setShipping({ key: regionKey, price }));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [regionKey, buyer.state, buyer.city]);
  const shippingPrice = shipping?.key === regionKey ? shipping.price : undefined;

  // Uma linha por produto e tamanho; o estoque é conferido somando os tamanhos.
  const rows = useMemo(
    () =>
      cart.lines.flatMap((line) => {
        const product = (products ?? []).find((p) => p.id === line.id);
        return product ? [{ product, line, quantity: line.quantity, units: unitsOf(cart.lines, product.id) }] : [];
      }),
    [products, cart.lines],
  );
  const subtotal = rows.reduce((sum, r) => sum + r.product.price * r.quantity, 0);
  const overStock = rows.some((r) => r.units > r.product.stock);

  if (products === null) return <div className="h-40 animate-pulse rounded-lg bg-surface" />;

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed border-line px-6 py-12 text-center">
        <p className="text-base text-hs-black">{t("empty")}</p>
        <Button asChild>
          <Link href="/scoot-world/store">{t("goToStore")}</Link>
        </Button>
      </div>
    );
  }

  const set = (key: CheckoutField) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = event.currentTarget.value;
    setBuyer((b) => ({ ...b, [key]: value }));
    setBadFields((f) => f.filter((x) => x !== key));
    setError(null);
  };
  const fieldError = (key: CheckoutField) => (badFields.includes(key) ? t(`errors.${key}`) : undefined);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    start(async () => {
      const result = await placeOrder(cart.lines, buyer);
      if (result.ok) {
        cart.clear();
        router.push(`/scoot-world/orders/${result.id}?k=${result.token}`);
        return;
      }
      if (result.error === "fields") {
        setBadFields(result.fields);
        setError(t("errors.fix"));
      } else {
        setError(t(`errors.${result.error}`));
        // Estoque pode ter mudado: busca de novo.
        if (result.error === "outOfStock") setRefetch((n) => n + 1);
      }
    });
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <div className="flex flex-col gap-8">
        <section aria-labelledby="cart-items" className="flex flex-col gap-3">
          <h2 id="cart-items" className="text-lg font-bold text-hs-black">{t("itemsTitle")}</h2>
          <ul className="flex flex-col gap-3">
            {rows.map(({ product, line, quantity, units }) => {
              const room = Math.min(product.stock, WORLD_LIMITS.perItem) - units;
              return (
                <li key={`${product.id}-${line.size ?? ""}`} className="flex gap-4 rounded-lg border border-line bg-hs-white p-3">
                  <ProductPhoto src={product.photo} className="size-20 shrink-0 rounded-md" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex flex-col">
                        <Link href={`/scoot-world/store/${product.id}`} className="text-sm font-semibold text-hs-black hover:underline">
                          {product.name}
                        </Link>
                        {line.size ? <span className="text-sm text-muted">{t("sizeLabel", { size: line.size })}</span> : null}
                      </span>
                      <button
                        type="button"
                        onClick={() => cart.remove(line)}
                        aria-label={t("remove", { name: product.name })}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center rounded-full border border-line" role="group" aria-label={t("quantityOf", { name: product.name })}>
                        <button
                          type="button"
                          onClick={() => cart.setQuantity(line, quantity - 1)}
                          disabled={quantity <= 1}
                          aria-label={t("less")}
                          className="flex size-9 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 disabled:opacity-40"
                        >
                          <Minus className="size-4" />
                        </button>
                        <span className="w-7 text-center text-sm font-semibold text-hs-black">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => cart.setQuantity(line, quantity + 1)}
                          disabled={room <= 0}
                          aria-label={t("more")}
                          className="flex size-9 items-center justify-center rounded-full text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 disabled:opacity-40"
                        >
                          <Plus className="size-4" />
                        </button>
                      </div>
                      <span className="text-base font-bold text-hs-black">{money(product.price * quantity)}</span>
                    </div>
                    {units > product.stock ? (
                      <p role="alert" className="text-sm text-error">
                        {product.stock > 0 ? t("onlyLeft", { count: product.stock }) : t("nowSoldOut")}
                      </p>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="cart-buyer" className="flex flex-col gap-4">
          <h2 id="cart-buyer" className="text-lg font-bold text-hs-black">{t("buyerTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField className="sm:col-span-2" label={t("fields.name")} autoComplete="name" value={buyer.name} onChange={set("name")} error={fieldError("name")} />
            <TextField label={t("fields.email")} type="email" autoComplete="email" value={buyer.email} onChange={set("email")} error={fieldError("email")} hint={t("hints.email")} />
            <TextField label={t("fields.phone")} type="tel" autoComplete="tel" inputMode="tel" value={buyer.phone} onChange={set("phone")} error={fieldError("phone")} />
            <TextField label={t("fields.cpf")} inputMode="numeric" value={buyer.cpf} onChange={set("cpf")} error={fieldError("cpf")} hint={t("hints.cpf")} />
          </div>
        </section>

        <section aria-labelledby="cart-address" className="flex flex-col gap-4">
          <h2 id="cart-address" className="text-lg font-bold text-hs-black">{t("addressTitle")}</h2>
          <div className="grid gap-4 sm:grid-cols-6">
            <TextField className="sm:col-span-2" label={t("fields.cep")} inputMode="numeric" autoComplete="postal-code" value={buyer.cep} onChange={set("cep")} error={fieldError("cep")} />
            <TextField className="sm:col-span-4" label={t("fields.street")} autoComplete="address-line1" value={buyer.street} onChange={set("street")} error={fieldError("street")} />
            <TextField className="sm:col-span-2" label={t("fields.number")} value={buyer.number} onChange={set("number")} error={fieldError("number")} />
            <TextField className="sm:col-span-4" label={t("fields.complement")} autoComplete="address-line2" value={buyer.complement} onChange={set("complement")} error={fieldError("complement")} />
            <TextField className="sm:col-span-3" label={t("fields.district")} value={buyer.district} onChange={set("district")} error={fieldError("district")} />
            <TextField className="sm:col-span-2" label={t("fields.city")} autoComplete="address-level2" value={buyer.city} onChange={set("city")} error={fieldError("city")} />
            <div className="flex flex-col gap-1.5 sm:col-span-1">
              <label htmlFor="cart-state" className="text-sm font-medium text-hs-black">
                {t("fields.state")}
              </label>
              <select
                id="cart-state"
                autoComplete="address-level1"
                value={buyer.state}
                onChange={set("state")}
                aria-invalid={fieldError("state") ? true : undefined}
                className="h-11 w-full rounded-md border border-line bg-hs-white px-3 text-base text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line"
              >
                <option value="">{t("statePick")}</option>
                {BR_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
              {fieldError("state") ? <p role="alert" className="text-sm text-error">{fieldError("state")}</p> : null}
            </div>
          </div>
        </section>
      </div>

      <aside aria-labelledby="cart-summary" className="flex h-fit flex-col gap-4 rounded-lg border border-line bg-hs-white p-5 lg:sticky lg:top-24">
        <h2 id="cart-summary" className="text-lg font-bold text-hs-black">{t("summaryTitle")}</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4 text-hs-black">
            <dt>{t("subtotal")}</dt>
            <dd>{money(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-hs-black">
            <dt>{t("shipping")}</dt>
            <dd>{shippingPrice === undefined ? <span className="text-muted">{t("shippingPending")}</span> : shippingPrice === null ? "-" : money(shippingPrice)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-bold text-hs-black">
            <dt>{t("total")}</dt>
            <dd>{money(subtotal + (shippingPrice ?? 0))}</dd>
          </div>
        </dl>
        {shippingPrice === null ? (
          <p role="alert" className="rounded-md border border-error-line bg-error-soft p-3 text-sm text-error">
            {t("errors.noShipping")}
          </p>
        ) : null}
        {!ready ? (
          <p role="note" className="rounded-md bg-blue-soft p-3 text-sm text-on-blue">
            {t("notReady")}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-md border border-error-line bg-error-soft p-3 text-sm text-error">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="lg" disabled={pending || !ready || overStock || shippingPrice === null} className="w-full">
          {pending ? t("paying") : t("payPix")}
        </Button>
        <p className="text-xs text-muted">{t("pixNote")}</p>
      </aside>
    </form>
  );
}
