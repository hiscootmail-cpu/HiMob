"use client";

import { startTransition, useActionState, useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { createCoupon, deleteCoupon, setCouponActive, updateCoupon, type CouponFormState } from "@/app/admin/coupons/actions";
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

export type CouponRow = {
  id: string;
  code: string;
  city: string | null;
  max_uses: number | null;
  per_person: number | null;
  max_days: number | null;
  valid_until: string | null;
  active: boolean;
  uses: number;
  kind: "free" | "discount";
  rental_percent: number;
  fee_percent: number;
};

/** Campos do cupom: os mesmos para criar e para editar. Limites vazios = sem limite. */
function CouponForm({
  action,
  coupon,
  submitLabel,
  onDone,
}: {
  action: (prev: CouponFormState, formData: FormData) => Promise<CouponFormState>;
  coupon?: CouponRow;
  submitLabel: string;
  onDone?: () => void;
}) {
  const t = useTranslations("adminCoupons");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(action, {} as CouponFormState);

  useEffect(() => {
    if (!state.done) return;
    toast.success(t("saved"));
    if (!coupon) formRef.current?.reset();
    onDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o estado muda
  }, [state]);

  // Envio sem o "limpar sozinho" do React: com erro, o que foi digitado fica.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => run(formData));
  };
  const err = (key: NonNullable<CouponFormState["error"]>) => (state.error === key ? t(`errors.${key}`) : undefined);
  const id = coupon?.id ?? "new";
  const [kind, setKind] = useState<"free" | "discount">(coupon?.kind ?? "free");

  return (
    <form ref={formRef} onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-hs-black">{t("kindLabel")}</legend>
        <div className="flex flex-wrap gap-2">
          {(["free", "discount"] as const).map((option) => (
            <label
              key={option}
              className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-hs-black has-checked:border-hs-black has-checked:bg-hs-black has-checked:text-hs-white"
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="sr-only"
              />
              {t(option === "free" ? "kindFree" : "kindDiscount")}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "discount" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id={`rental-percent-${id}`}
            name="rental_percent"
            label={t("rentalPercent")}
            hint={t("rentalPercentHint")}
            inputMode="numeric"
            defaultValue={coupon?.rental_percent || ""}
            error={err("percent")}
          />
          <TextField
            id={`fee-percent-${id}`}
            name="fee_percent"
            label={t("feePercent")}
            hint={t("feePercentHint")}
            inputMode="numeric"
            defaultValue={coupon?.fee_percent || ""}
          />
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id={`code-${id}`}
          name="code"
          label={t("code")}
          hint={t("codeHint")}
          defaultValue={coupon?.code}
          maxLength={30}
          autoCapitalize="characters"
          required
          error={err("code") ?? err("codeTaken")}
        />
        <TextField id={`city-${id}`} name="city" label={t("city")} hint={t("cityHint")} defaultValue={coupon?.city ?? ""} maxLength={80} error={err("city")} />
        <TextField id={`max-uses-${id}`} name="max_uses" label={t("maxUses")} hint={t("emptyNoLimit")} inputMode="numeric" defaultValue={coupon?.max_uses ?? ""} error={err("maxUses")} />
        <TextField id={`per-person-${id}`} name="per_person" label={t("perPerson")} hint={t("emptyNoLimit")} inputMode="numeric" defaultValue={coupon?.per_person ?? ""} error={err("perPerson")} />
        <TextField id={`max-days-${id}`} name="max_days" label={t("maxDays")} hint={t("emptyNoLimit")} inputMode="numeric" defaultValue={coupon?.max_days ?? ""} error={err("maxDays")} />
        <TextField id={`valid-until-${id}`} name="valid_until" type="date" label={t("validUntil")} hint={t("emptyNoDate")} defaultValue={coupon?.valid_until ?? ""} error={err("validUntil")} />
      </div>
      {state.error === "notAllowed" || state.error === "saveFailed" ? (
        <p role="alert" className="text-sm text-error">
          {t(`errors.${state.error}`)}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}

export function NewCouponForm() {
  const t = useTranslations("adminCoupons");
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-line bg-hs-white p-4">
      <h2 className="text-lg font-bold text-hs-black">{t("newTitle")}</h2>
      <p className="text-sm text-muted">{t("newHelp")}</p>
      <CouponForm action={createCoupon} submitLabel={t("create")} />
    </section>
  );
}

/** Um cupom da lista: editar, desligar/ligar e apagar. */
export function CouponItem({ coupon }: { coupon: CouponRow }) {
  const t = useTranslations("adminCoupons");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const limits = [
    coupon.city ? t("onlyCity", { city: coupon.city }) : t("anyCity"),
    coupon.max_uses ? t("usesOf", { uses: coupon.uses, max: coupon.max_uses }) : t("uses", { uses: coupon.uses }),
    coupon.per_person ? t("perPersonShown", { count: coupon.per_person }) : null,
    coupon.max_days ? t("maxDaysShown", { count: coupon.max_days }) : null,
    coupon.valid_until ? t("untilShown", { date: coupon.valid_until.split("-").reverse().join("/") }) : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-hs-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-mono text-base font-bold text-hs-black">{coupon.code}</p>
        <span className={coupon.active ? "rounded-full bg-green-soft px-2.5 py-0.5 text-xs font-semibold text-on-green" : "rounded-full bg-surface px-2.5 py-0.5 text-xs font-semibold text-hs-black"}>
          {coupon.active ? t("on") : t("off")}
        </span>
        <span className="rounded-full bg-purple-soft px-2.5 py-0.5 text-xs font-semibold text-on-purple">
          {coupon.kind === "discount"
            ? t("discountShown", { rental: coupon.rental_percent, fee: coupon.fee_percent })
            : t("kindFree")}
        </span>
      </div>
      <p className="text-sm text-hs-black">{limits.join(" · ")}</p>
      {editing ? (
        <div className="rounded-md bg-surface p-4">
          <CouponForm action={updateCoupon.bind(null, coupon.id)} coupon={coupon} submitLabel={t("saveChanges")} onDone={() => setEditing(false)} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
          {editing ? t("closeEdit") : t("edit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              if (await setCouponActive(coupon.id, !coupon.active)) toast.success(t(coupon.active ? "turnedOff" : "turnedOn"));
              else toast.error(t("errors.saveFailed"));
            })
          }
        >
          {coupon.active ? t("turnOff") : t("turnOn")}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="sm" disabled={pending}>
              {t("delete")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>{t("deleteTitle", { code: coupon.code })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteText")}</AlertDialogDescription>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                destructive
                onClick={() =>
                  start(async () => {
                    if (await deleteCoupon(coupon.id)) toast.success(t("deleted"));
                    else toast.error(t("errors.saveFailed"));
                  })
                }
              >
                {t("deleteConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}
