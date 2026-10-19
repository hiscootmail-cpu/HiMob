"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  addWorldPlace,
  addWorldProduct,
  addWorldVideo,
  deleteWorldItem,
  setWorldItemActive,
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
import { WORLD_LIMITS } from "@/lib/scoot-world-rules";
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
      <TextField name="price" label={t("price")} hint={t("priceHint")} inputMode="decimal" required error={fieldError("price")} />
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
export function ItemControls({ table, id, name, active }: { table: WorldTable; id: string; name: string; active: boolean }) {
  const t = useTranslations("adminWorld");
  const [pending, start] = useTransition();

  const toggle = () =>
    start(async () => {
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
      <Button type="button" variant="outline" size="sm" disabled={pending} onClick={toggle}>
        {active ? t("hide") : t("show")}
      </Button>
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
