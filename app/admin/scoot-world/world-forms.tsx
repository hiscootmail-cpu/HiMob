"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  addShippingRate,
  addWorldPlace,
  addWorldProduct,
  addWorldVideo,
  deleteWorldItem,
  refundOrder,
  setWorldItemActive,
  shipOrder,
  updateWorldStock,
  type WorldFormState,
  type WorldTable,
} from "@/app/admin/scoot-world/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import type { LatLng } from "@/lib/geo";
import { BR_STATES, WORLD_LIMITS } from "@/lib/scoot-world-rules";
import { cn } from "@/lib/utils";

// O mapa só existe no navegador (Leaflet usa a janela do navegador).
const LocationPicker = dynamic(() => import("@/app/admin/scoot-world/location-picker"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-line" />,
});

const textareaClass =
  "w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none placeholder:text-muted focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line";

/** Mensagem de erro do formulário e aviso de "salvo"; limpa o formulário depois de salvar. */
function useWorldForm(action: (prev: WorldFormState, formData: FormData) => Promise<WorldFormState>, onSaved?: () => void) {
  const t = useTranslations("adminWorld");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(action, {} as WorldFormState);

  useEffect(() => {
    if (state.done) {
      formRef.current?.reset();
      onSaved?.();
      toast.success(t("saved"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o estado muda
  }, [state]);

  // Envio sem o "limpar sozinho" do React: com erro, o que a pessoa digitou fica no formulário.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => run(formData));
  };
  const fieldError = (field: NonNullable<WorldFormState["error"]>) => (state.error === field ? t(`errors.${field}`) : undefined);
  const formError =
    state.error === "notAllowed" || state.error === "saveFailed" ? (
      <p role="alert" className="text-sm text-error">
        {t(`errors.${state.error}`)}
      </p>
    ) : null;
  return { formRef, submit, pending, fieldError, formError };
}

function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  const message = error ?? hint;
  return message ? (
    <p id={id} role={error ? "alert" : undefined} className={cn("text-sm", error ? "text-error" : "text-muted")}>
      {message}
    </p>
  ) : null;
}

export function ProductForm() {
  const t = useTranslations("adminWorld.store");
  const tCommon = useTranslations("adminWorld");
  const { formRef, submit, pending, fieldError, formError } = useWorldForm(addWorldProduct);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <h2 className="text-lg font-bold text-hs-black">{t("addTitle")}</h2>
      <TextField name="name" label={t("name")} required maxLength={WORLD_LIMITS.productName.max} error={fieldError("name")} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="price" label={t("price")} hint={t("priceHint")} inputMode="decimal" required error={fieldError("price")} />
        <TextField name="stock" label={t("stock")} hint={t("stockHint")} inputMode="numeric" required error={fieldError("stock")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="product-description" className="text-sm font-medium text-hs-black">
          {t("description")}
        </label>
        <textarea
          id="product-description"
          name="description"
          rows={3}
          maxLength={WORLD_LIMITS.productDescription}
          aria-invalid={fieldError("description") ? true : undefined}
          aria-describedby="product-description-message"
          className={textareaClass}
        />
        <FieldMessage id="product-description-message" error={fieldError("description")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="product-photo" className="text-sm font-medium text-hs-black">
          {t("photo")}
        </label>
        <input
          id="product-photo"
          name="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-describedby="product-photo-message"
          className="text-sm text-hs-black file:mr-3 file:h-9 file:cursor-pointer file:rounded-full file:border file:border-hs-black/20 file:bg-hs-white file:px-4 file:text-sm file:font-semibold file:text-hs-black"
        />
        <FieldMessage id="product-photo-message" error={fieldError("photo")} hint={t("photoHint")} />
      </div>
      {formError}
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? tCommon("saving") : t("add")}
      </Button>
    </form>
  );
}

export function VideoForm() {
  const t = useTranslations("adminWorld.tv");
  const tCommon = useTranslations("adminWorld");
  const { formRef, submit, pending, fieldError, formError } = useWorldForm(addWorldVideo);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <h2 className="text-lg font-bold text-hs-black">{t("addTitle")}</h2>
      <TextField name="title" label={t("videoTitle")} required maxLength={WORLD_LIMITS.videoTitle.max} error={fieldError("title")} />
      <TextField
        name="youtube"
        label={t("link")}
        hint={t("linkHint")}
        placeholder="https://www.youtube.com/watch?v=..."
        required
        error={fieldError("youtube")}
      />
      {formError}
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? tCommon("saving") : t("add")}
      </Button>
    </form>
  );
}

export function PlaceForm() {
  const t = useTranslations("adminWorld.places");
  const tCommon = useTranslations("adminWorld");
  const [point, setPoint] = useState<LatLng | null>(null);
  const { formRef, submit, pending, fieldError, formError } = useWorldForm(addWorldPlace, () => setPoint(null));

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <h2 className="text-lg font-bold text-hs-black">{t("addTitle")}</h2>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-hs-black">{t("kindLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["partner", "workshop"] as const).map((kind) => (
            <label
              key={kind}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-hs-black has-checked:border-hs-black has-checked:bg-hs-black has-checked:text-hs-white"
            >
              <input type="radio" name="kind" value={kind} defaultChecked={kind === "partner"} className="sr-only" />
              {t(`kind.${kind}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <TextField name="name" label={t("name")} required maxLength={WORLD_LIMITS.placeName.max} error={fieldError("name")} />
      <TextField name="address" label={t("address")} hint={t("addressHint")} required maxLength={WORLD_LIMITS.placeAddress.max} error={fieldError("address")} />
      <TextField name="city" label={t("city")} required maxLength={WORLD_LIMITS.placeCity.max} error={fieldError("city")} />
      <TextField name="phone" label={t("phone")} hint={t("phoneHint")} inputMode="tel" error={fieldError("phone")} />
      <TextField name="services" label={t("services")} hint={t("servicesHint")} maxLength={WORLD_LIMITS.placeServices} error={fieldError("services")} />
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-hs-black">{t("location")}</p>
        <div className="h-64 overflow-hidden rounded-md border border-line">
          <LocationPicker value={point} onPick={setPoint} />
        </div>
        <input type="hidden" name="latitude" value={point?.latitude ?? ""} />
        <input type="hidden" name="longitude" value={point?.longitude ?? ""} />
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-muted">{point ? t("locationSet") : t("locationHint")}</p>
          {point ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setPoint(null)}>
              {t("locationClear")}
            </Button>
          ) : null}
        </div>
      </div>
      {formError}
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? tCommon("saving") : t("add")}
      </Button>
    </form>
  );
}

/** Esconder/mostrar (reversível) e Apagar (irreversível, com confirmação). */
export function ItemControls({
  table,
  id,
  name,
  active,
}: {
  table: WorldTable | "world_shipping_rates";
  id: string;
  name: string;
  /** Sem "active" (frete), só Apagar. */
  active?: boolean;
}) {
  const t = useTranslations("adminWorld");
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
      if (table === "world_shipping_rates") return;
      if (!(await setWorldItemActive(table, id, !active))) toast.error(t("errors.saveFailed"));
      else toast.success(t(active ? "hidden" : "shown"));
    });
  const remove = () =>
    start(async () => {
      if (!(await deleteWorldItem(table, id))) toast.error(t("errors.saveFailed"));
      else toast.success(t("deleted"));
    });

  return (
    <div className="flex flex-wrap gap-2">
      {active === undefined ? null : (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={toggle}>
          {active ? t("hide") : t("show")}
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="sm" disabled={pending}>
            {t("delete")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogTitle>{t("deleteTitle", { name })}</AlertDialogTitle>
          <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction destructive onClick={remove}>
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Ajustar estoque de um produto já cadastrado. */
export function StockForm({ id, stock }: { id: string; stock: number }) {
  const t = useTranslations("adminWorld.store");
  const { formRef, submit, pending, fieldError, formError } = useWorldForm(updateWorldStock.bind(null, id));
  const inputId = `stock-${id}`;

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-xs font-medium text-hs-black">
          {t("stock")}
        </label>
        <input
          id={inputId}
          name="stock"
          inputMode="numeric"
          defaultValue={stock}
          aria-invalid={fieldError("stock") ? true : undefined}
          className="h-9 w-24 rounded-md border border-line bg-hs-white px-3 text-sm text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line"
        />
      </div>
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {t("stockSave")}
      </Button>
      {fieldError("stock") ? <p role="alert" className="w-full text-sm text-error">{fieldError("stock")}</p> : null}
      {formError}
    </form>
  );
}

export function ShippingForm() {
  const t = useTranslations("adminWorld.shipping");
  const tCommon = useTranslations("adminWorld");
  const { formRef, submit, pending, fieldError, formError } = useWorldForm(addShippingRate);

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <h2 className="text-lg font-bold text-hs-black">{t("addTitle")}</h2>
      <p className="text-sm text-muted">{t("help")}</p>
      <div className="grid gap-4 sm:grid-cols-[8rem_1fr_10rem]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="rate-state" className="text-sm font-medium text-hs-black">
            {t("state")}
          </label>
          <select
            id="rate-state"
            name="state"
            required
            defaultValue=""
            aria-invalid={fieldError("state") ? true : undefined}
            className="h-11 w-full rounded-md border border-line bg-hs-white px-3 text-base text-hs-black outline-none focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line"
          >
            <option value="" disabled>
              {t("statePick")}
            </option>
            {BR_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
          {fieldError("state") ? <p role="alert" className="text-sm text-error">{fieldError("state")}</p> : null}
        </div>
        <TextField name="city" label={t("city")} hint={t("cityHint")} maxLength={WORLD_LIMITS.placeCity.max} error={fieldError("city")} />
        <TextField name="price" label={t("price")} inputMode="decimal" required error={fieldError("shippingPrice")} />
      </div>
      {fieldError("regionTaken") ? <p role="alert" className="text-sm text-error">{fieldError("regionTaken")}</p> : null}
      {formError}
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? tCommon("saving") : t("add")}
      </Button>
    </form>
  );
}

/** Pedido pago: "Marcar como enviado" com o código de rastreio. */
export function ShipForm({ id }: { id: string }) {
  const t = useTranslations("adminWorld.orders");
  const { formRef, submit, pending, fieldError, formError } = useWorldForm(shipOrder.bind(null, id));

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <TextField name="tracking" label={t("tracking")} maxLength={60} required error={fieldError("tracking")} className="min-w-56 flex-1" />
      <Button type="submit" disabled={pending}>
        {t("ship")}
      </Button>
      {formError}
    </form>
  );
}

/** Pedido pago e ainda não enviado: cancelar e devolver o dinheiro (irreversível, motivo obrigatório). */
export function RefundForm({ id, code }: { id: string; code: string }) {
  const t = useTranslations("adminWorld.orders");
  const tCommon = useTranslations("adminWorld");
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, run, pending] = useActionState(refundOrder.bind(null, id), {} as WorldFormState);
  const valid = reason.trim().length >= 5 && reason.trim().length <= 200;

  useEffect(() => {
    if (state.done) toast.success(t("refunded"));
    else if (state.error) toast.error(t(state.error === "refundFailed" ? "refundFailed" : "refundError"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o estado muda
  }, [state]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" size="sm" disabled={pending}>
          {t("refund")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle>{t("refundTitle", { code })}</AlertDialogTitle>
        <AlertDialogDescription>{t("refundText")}</AlertDialogDescription>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`refund-${id}`} className="text-sm font-medium text-hs-black">
            {t("reason")}
          </label>
          <textarea
            id={`refund-${id}`}
            rows={2}
            maxLength={200}
            value={reason}
            onChange={(event) => setReason(event.currentTarget.value)}
            className={textareaClass}
          />
          <p className="text-sm text-muted">{t("reasonHint")}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
          <AlertDialogAction
            destructive
            disabled={!valid || pending}
            onClick={(event) => {
              if (!valid) {
                event.preventDefault();
                return;
              }
              const formData = new FormData();
              formData.set("reason", reason);
              startTransition(() => run(formData));
            }}
          >
            {t("refundConfirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
