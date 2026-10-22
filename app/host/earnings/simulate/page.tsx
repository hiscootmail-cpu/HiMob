import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EarningsTabs } from "@/components/host/earnings-tabs";
import { listHostListings } from "@/lib/host";
import { getCurrentUser, requireUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { Simulator } from "./simulator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("host.earnings.sim");
  return { title: t("title") };
}

/** Simular ganhos com mais equipamentos e em outras cidades (decisão de 22/10/2026). */
export default async function SimulatePage() {
  if (supabaseConfigured()) await requireUser();
  const t = await getTranslations("host.earnings");
  const [listings, user] = await Promise.all([listHostListings(), getCurrentUser()]);
  const prices = listings.map((l) => l.daily_price).filter((p) => p > 0);
  const daily = prices.length ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : 35;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("sim.subtitle")}</p>
      </div>
      <EarningsTabs />
      <Simulator
        defaults={{
          equipment: Math.max(1, listings.length + 1),
          daily,
          city: user?.city && user.city_state ? { city: user.city, uf: user.city_state } : null,
        }}
      />
    </div>
  );
}
