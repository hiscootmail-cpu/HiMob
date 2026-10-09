"use client";

import { startTransition, useActionState, useRef, useState } from "react";
import { Bike, LocateFixed } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import type { ListingState } from "@/app/host/equipment/actions";
import { CheckCircleIcon, ScooterIcon } from "@/components/icons";
import { PhotoPicker } from "@/components/host/photo-picker";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { MAX_PHOTOS, MIN_PHOTOS, type EquipmentType } from "@/lib/equipment";
import { PHOTO_MAX_MB } from "@/lib/handoff";
import {
  DESCRIPTION_MAX,
  PRICE_MAX,
  TITLE_MAX,
  parsePrice,
  readListingForm,
  validateListing,
  type ListingError,
  type ListingErrors,
  type ListingField,
} from "@/lib/listing";
import { PLATFORM_FEE_PERCENT, SUGGESTED_DAILY_PRICE, riderDailyPrice } from "@/lib/pricing";
import { cn } from "@/lib/utils";

export type ListingDefaults = {
  type: EquipmentType;
  title: string;
  description: string;
  daily_price: number;
  city: string;
  area: string;
  pickup_address: string;
  latitude: number;
  longitude: number;
  pickup_time: string;
  return_time: string;
};

type ListingFormProps = {
  /** Ação do servidor (criar ou editar). */
  action: (prev: ListingState, formData: FormData) => Promise<ListingState>;
  mode: "new" | "edit";
  defaults?: ListingDefaults;
};

type LocationStatus = "idle" | "locating" | "saved" | "denied";

/** Formulário do anúncio: o mesmo para criar e para editar. */
export function ListingForm({ action, mode, defaults }: ListingFormProps) {
  const t = useTranslations("host.form");
  const format = useFormatter();
  const money = (value: number) => format.number(value, { style: "currency", currency: "BRL" });
  const formRef = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState(action, {} as ListingState);

  const [type, setType] = useState<EquipmentType | "">(defaults?.type ?? "");
  const [price, setPrice] = useState(defaults ? String(defaults.daily_price).replace(".", ",") : "");
  const [photos, setPhotos] = useState<File[]>([]);
  const [coords, setCoords] = useState(defaults ? { lat: defaults.latitude, lng: defaults.longitude } : null);
  const [location, setLocation] = useState<LocationStatus>(defaults ? "saved" : "idle");
  const [local, setLocal] = useState<{ submission: unknown; errors: ListingErrors }>({ submission: state, errors: {} });

  const errors = local.submission === state ? local.errors : (state.errors ?? {});
  const clear = (field: ListingField) => {
    if (errors[field]) setLocal({ submission: state, errors: { ...errors, [field]: undefined } });
  };
  const message = (field: ListingField) => {
    const key: ListingError | undefined = errors[field];
    if (!key) return undefined;
    return t(`errors.${key}`, {
      min: MIN_PHOTOS,
      max: field === "title" ? TITLE_MAX : field === "description" ? DESCRIPTION_MAX : MAX_PHOTOS,
      size: PHOTO_MAX_MB,
      price: PRICE_MAX,
    });
  };

  const hostPrice = parsePrice(price);

  function locate() {
    if (!("geolocation" in navigator)) {
      setLocation("denied");
      return;
    }
    setLocation("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setLocation("saved");
        clear("location");
      },
      () => setLocation("denied"),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    // Envio manual: o formulário não é limpo e as fotos escolhidas continuam.
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.delete("photos");
    photos.forEach((photo) => formData.append("photos", photo));

    const found = validateListing(readListingForm(formData, mode === "edit"));
    setLocal({ submission: state, errors: found });
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"], [data-invalid="true"]')?.focus());
      return;
    }
    startTransition(() => submit(formData));
  }

  const types: { value: EquipmentType; icon: React.ReactNode }[] = [
    { value: "scooter", icon: <ScooterIcon className="size-7" /> },
    { value: "ebike", icon: <Bike className="size-7" aria-hidden strokeWidth={1.8} /> },
  ];

  const sectionClass = "flex min-w-0 flex-col gap-4 rounded-lg border border-line bg-hs-white p-4 sm:p-5";
  const textareaClass =
    "w-full rounded-md border border-line bg-hs-white px-4 py-3 text-base text-hs-black outline-none placeholder:text-muted hover:border-hs-black/30 focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25 aria-invalid:border-error-line";

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      {/* 1. Equipamento */}
      <section className={sectionClass} aria-labelledby="sec-equipment">
        <h2 id="sec-equipment" className="text-lg font-semibold text-hs-black">
          {t("sectionEquipment")}
        </h2>
        <fieldset className="flex min-w-0 flex-col gap-2" aria-describedby={errors.type ? "type-message" : undefined}>
          <legend className="mb-1 text-sm font-medium text-hs-black">{t("typeLabel")}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {types.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border-2 p-4 transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-hs-blue/40",
                  type === option.value
                    ? "border-hs-green bg-green-soft"
                    : errors.type
                      ? "border-error-line bg-hs-white"
                      : "border-line bg-hs-white hover:bg-surface",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={type === option.value}
                  onChange={() => {
                    setType(option.value);
                    clear("type");
                  }}
                  data-invalid={errors.type ? true : undefined}
                  className="size-5 accent-hs-green"
                />
                <span className="text-hs-black">{option.icon}</span>
                <span className="text-base font-semibold text-hs-black">{t(`types.${option.value}`)}</span>
              </label>
            ))}
          </div>
          {errors.type ? (
            <p id="type-message" role="alert" className="text-sm text-error">
              {t("errors.typeRequired")}
            </p>
          ) : null}
        </fieldset>

        <TextField
          name="title"
          label={t("titleLabel")}
          placeholder={t("titlePlaceholder")}
          defaultValue={defaults?.title}
          maxLength={TITLE_MAX}
          hint={t("titleHint")}
          error={message("title")}
          onChange={() => clear("title")}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="listing-description" className="text-sm font-medium text-hs-black">
            {t("descriptionLabel")}
          </label>
          <textarea
            id="listing-description"
            name="description"
            rows={5}
            maxLength={DESCRIPTION_MAX}
            defaultValue={defaults?.description}
            placeholder={t("descriptionPlaceholder")}
            aria-invalid={errors.description ? true : undefined}
            aria-describedby="listing-description-message"
            onChange={() => clear("description")}
            className={textareaClass}
          />
          <p id="listing-description-message" role={errors.description ? "alert" : undefined} className={cn("text-sm", errors.description ? "text-error" : "text-muted")}>
            {message("description") ?? t("descriptionHint")}
          </p>
        </div>
      </section>

      {/* 2. Fotos */}
      <section className={sectionClass} aria-label={t("photosLabel")}>
        <PhotoPicker
          files={photos}
          onChange={(next) => {
            setPhotos(next);
            clear("photos");
          }}
          error={message("photos")}
          note={mode === "edit" ? t("photosKeepNote") : undefined}
        />
      </section>

      {/* 3. Preço */}
      <section className={sectionClass} aria-labelledby="sec-price">
        <h2 id="sec-price" className="text-lg font-semibold text-hs-black">
          {t("sectionPrice")}
        </h2>
        <TextField
          name="daily_price"
          label={t("priceLabel")}
          inputMode="decimal"
          autoComplete="off"
          placeholder="35,00"
          value={price}
          onChange={(event) => {
            setPrice(event.currentTarget.value);
            clear("daily_price");
          }}
          hint={t("priceSuggestion", {
            min: money(SUGGESTED_DAILY_PRICE.min),
            max: money(SUGGESTED_DAILY_PRICE.max),
          })}
          error={message("daily_price")}
        />
        <div className="flex flex-col gap-1 rounded-md bg-surface p-4" aria-live="polite">
          {hostPrice ? (
            <>
              <p className="text-base text-hs-black">
                {t.rich("riderSees", {
                  price: money(riderDailyPrice(hostPrice)),
                  strong: (chunks) => <strong className="font-bold">{chunks}</strong>,
                })}
              </p>
              <p className="text-sm text-muted">
                {t("riderSeesFee", { percent: PLATFORM_FEE_PERCENT, fee: money(riderDailyPrice(hostPrice) - hostPrice) })}
              </p>
              <p className="text-sm text-hs-black">{t("youReceive", { price: money(hostPrice) })}</p>
            </>
          ) : (
            <p className="text-sm text-muted">{t("pricePreviewEmpty", { percent: PLATFORM_FEE_PERCENT })}</p>
          )}
        </div>
      </section>

      {/* 4. Onde e quando */}
      <section className={sectionClass} aria-labelledby="sec-where">
        <h2 id="sec-where" className="text-lg font-semibold text-hs-black">
          {t("sectionWhere")}
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            name="city"
            label={t("cityLabel")}
            autoComplete="address-level2"
            defaultValue={defaults?.city ?? "São Paulo"}
            error={message("city")}
            onChange={() => clear("city")}
          />
          <TextField
            name="area"
            label={t("areaLabel")}
            placeholder={t("areaPlaceholder")}
            defaultValue={defaults?.area}
            hint={t("areaHint")}
            error={message("area")}
            onChange={() => clear("area")}
          />
        </div>
        <TextField
          name="pickup_address"
          label={t("addressLabel")}
          autoComplete="street-address"
          placeholder={t("addressPlaceholder")}
          defaultValue={defaults?.pickup_address}
          hint={t("addressHint")}
          error={message("pickup_address")}
          onChange={() => clear("pickup_address")}
        />

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-hs-black">{t("locationLabel")}</p>
          <p className="text-sm text-muted">{t("locationHelp")}</p>
          <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
          <input type="hidden" name="longitude" value={coords?.lng ?? ""} />
          <Button
            type="button"
            variant="outline"
            onClick={locate}
            loading={location === "locating"}
            aria-invalid={errors.location ? true : undefined}
            aria-describedby="location-message"
            className={cn("w-full sm:w-fit", errors.location && "border-error-line")}
          >
            <LocateFixed aria-hidden />
            {location === "saved" ? t("locationUpdate") : t("locationUse")}
          </Button>
          <p
            id="location-message"
            role={errors.location || location === "denied" ? "alert" : "status"}
            className={cn(
              "flex items-center gap-2 text-sm",
              errors.location || location === "denied" ? "text-error" : "text-hs-black",
            )}
          >
            {location === "saved" ? <CheckCircleIcon className="size-4 text-on-green" /> : null}
            {location === "denied"
              ? t("locationDenied")
              : errors.location
                ? message("location")
                : location === "saved"
                  ? t("locationSaved")
                  : null}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField
            name="pickup_time"
            type="time"
            label={t("pickupTimeLabel")}
            defaultValue={defaults?.pickup_time}
            error={message("pickup_time")}
            onChange={() => clear("pickup_time")}
          />
          <TextField
            name="return_time"
            type="time"
            label={t("returnTimeLabel")}
            defaultValue={defaults?.return_time}
            error={message("return_time")}
            onChange={() => clear("return_time")}
          />
        </div>
        <p className="text-sm text-muted">{t("timesHint")}</p>
      </section>

      {state.error ? (
        <p role="alert" className="text-sm text-error">
          {t("errors.notAllowed")}
        </p>
      ) : Object.values(errors).some(Boolean) ? (
        <p role="alert" className="text-sm text-error">
          {t("errors.summary")}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" loading={pending} className="w-full sm:w-fit sm:self-end">
          {mode === "edit" ? t("submitEdit") : t("submitNew")}
        </Button>
        <p className="text-sm text-muted sm:text-right">{mode === "edit" ? t("reviewNoteEdit") : t("reviewNoteNew")}</p>
      </div>
    </form>
  );
}
