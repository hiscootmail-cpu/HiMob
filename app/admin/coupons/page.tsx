import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { CouponItem, NewCouponForm, type CouponRow } from "@/app/admin/coupons/coupon-forms";
import { BackLink } from "@/components/rider/back-link";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminCoupons");
  return { title: t("title") };
}

/** Cupons de exemplo da demonstração (sem Supabase). */
const EXAMPLES: CouponRow[] = [
  { id: "cupom-exemplo-mogi", code: "SCOOTEMMOGI", city: "Mogi Mirim", max_uses: null, per_person: null, max_days: null, valid_until: null, active: true, uses: 0, kind: "free", rental_percent: 0, fee_percent: 0 },
];

async function listCoupons(): Promise<CouponRow[]> {
  if (!supabaseConfigured()) return EXAMPLES;
  const supabase = await createClient();
  const [{ data: coupons }, { data: used }] = await Promise.all([
    supabase.from("coupons").select("id, code, city, max_uses, per_person, max_days, valid_until, active, kind, rental_percent, fee_percent").order("created_at", { ascending: false }),
    // Usos que contam para o limite: reservas que não foram recusadas nem canceladas.
    supabase.from("bookings").select("coupon_id").not("coupon_id", "is", null).not("status", "in", "(rejected,cancelled)"),
  ]);
  const count = new Map<string, number>();
  for (const row of used ?? []) count.set(row.coupon_id as string, (count.get(row.coupon_id as string) ?? 0) + 1);
  return (coupons ?? []).map((c) => ({ ...c, kind: c.kind === "discount" ? "discount" : "free", uses: count.get(c.id) ?? 0 }));
}

/** Painel da equipe: cupons de aluguel (decisão de 20/10/2026). */
export default async function AdminCouponsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");
  const t = await getTranslations("adminCoupons");
  const coupons = await listCoupons();

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/admin" label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>
      <NewCouponForm />
      {coupons.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-base text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {coupons.map((coupon) => (
            <CouponItem key={coupon.id} coupon={coupon} />
          ))}
        </ul>
      )}
    </div>
  );
}
