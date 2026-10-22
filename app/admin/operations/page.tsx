import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { RegionPicker, type RegionOption } from "@/app/admin/operations/region-picker";
import { BackLink } from "@/components/rider/back-link";
import { listPlaces, type Place } from "@/lib/regions";
import { getCurrentUser } from "@/lib/session";
import { supabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("adminOperations");
  return { title: t("title") };
}

type TypeNumbers = { published: number; with_days: number; in_use: number };

type Operations = {
  riders: number;
  riders_verified: number;
  hosts: number;
  equipment: { scooter?: TypeNumbers; ebike?: TypeNumbers };
  pickups_today: number;
  queue_listings: number;
  queue_edits: number;
  queue_identity: number;
};

/** Filtro escolhido (?r=): "city:Mogi Mirim", "state:BR:São Paulo" ou "country:BR". */
type Filter = { p_city: string | null; p_state: string | null; p_country: string | null };

const TYPES = ["scooter", "ebike"] as const;
const EMPTY: TypeNumbers = { published: 0, with_days: 0, in_use: 0 };

/** Números de exemplo da demonstração (sem Supabase). */
const EXAMPLE: Operations = {
  riders: 42,
  riders_verified: 18,
  hosts: 6,
  equipment: { scooter: { published: 9, with_days: 7, in_use: 2 }, ebike: { published: 3, with_days: 2, in_use: 1 } },
  pickups_today: 4,
  queue_listings: 1,
  queue_edits: 0,
  queue_identity: 2,
};

const EXAMPLE_PLACES: Place[] = [
  { city: "Jaguariúna", state: "São Paulo", state_code: "SP", country: "BR", latitude: null, longitude: null },
  { city: "Mogi Mirim", state: "São Paulo", state_code: "SP", country: "BR", latitude: null, longitude: null },
  { city: "São Paulo", state: "São Paulo", state_code: "SP", country: "BR", latitude: null, longitude: null },
  { city: "Rio de Janeiro", state: "Rio de Janeiro", state_code: "RJ", country: "BR", latitude: null, longitude: null },
];

function parseFilter(value: string | null): Filter {
  const none: Filter = { p_city: null, p_state: null, p_country: null };
  if (!value) return none;
  const [kind, ...rest] = value.split(":");
  if (kind === "city" && rest.join(":").trim()) return { ...none, p_city: rest.join(":").trim() };
  if (kind === "state" && rest.length >= 2) return { ...none, p_country: rest[0], p_state: rest.slice(1).join(":") };
  if (kind === "country" && /^[A-Z]{2}$/.test(rest[0] ?? "")) return { ...none, p_country: rest[0] };
  return none;
}

/** Sugestões do filtro: países, estados e cidades com anúncio. */
function regionOptions(places: Place[], locale: string): RegionOption[] {
  const names = new Intl.DisplayNames([locale === "en" ? "en" : "pt-BR"], { type: "region" });
  const countryName = (code: string) => names.of(code) ?? code;
  const options = new Map<string, RegionOption>();
  for (const place of places) {
    if (place.country) {
      options.set(`country:${place.country}`, { value: `country:${place.country}`, label: countryName(place.country), detail: "", kind: "country" });
      if (place.state) {
        const value = `state:${place.country}:${place.state}`;
        options.set(value, {
          value,
          label: place.state_code ? `${place.state} (${place.state_code})` : place.state,
          detail: countryName(place.country),
          kind: "state",
        });
      }
    }
    const value = `city:${place.city}`;
    const where = [place.state_code ?? place.state, place.country ? countryName(place.country) : null].filter(Boolean).join(", ");
    options.set(value, { value, label: place.city, detail: where, kind: "city" });
  }
  const order = { country: 0, state: 1, city: 2 };
  return [...options.values()].sort((a, b) => order[a.kind] - order[b.kind] || a.label.localeCompare(b.label, "pt-BR"));
}

type TripDemand = {
  city: string;
  city_state: string;
  next7: number;
  next30: number;
  next90: number;
  wants_scooter: number;
  wants_ebike: number;
  wants_both: number;
  equipment: number;
};

const EXAMPLE_DEMAND: TripDemand[] = [
  { city: "Ubatuba", city_state: "SP", next7: 3, next30: 8, next90: 15, wants_scooter: 7, wants_ebike: 3, wants_both: 5, equipment: 0 },
  { city: "Rio de Janeiro", city_state: "RJ", next7: 1, next30: 4, next90: 9, wants_scooter: 4, wants_ebike: 2, wants_both: 3, equipment: 2 },
];

/** Viagens marcadas pelos Riders, por cidade (demanda futura, decisão de 22/10/2026). */
async function loadTripDemand(filter: Filter): Promise<TripDemand[] | null> {
  if (!supabaseConfigured()) return EXAMPLE_DEMAND;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_trip_demand", filter);
  return error ? null : ((data ?? []) as TripDemand[]);
}

async function loadOperations(filter: Filter): Promise<Operations | null> {
  if (!supabaseConfigured()) return EXAMPLE;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_operations", filter);
  return error ? null : (data as Operations);
}

function Tile({ label, value, hint, href }: { label: string; value: number; hint?: string; href?: string }) {
  const body = (
    <>
      <span className="text-sm font-medium text-muted">{label}</span>
      <span className="text-3xl font-bold text-hs-black">{value}</span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </>
  );
  const style = "flex flex-col gap-1 rounded-lg border border-line bg-hs-white p-4";
  return href ? (
    <Link href={href} className={cn(style, "outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40")}>
      {body}
    </Link>
  ) : (
    <div className={style}>{body}</div>
  );
}

/** Painel da equipe → Operação (decisão de 21/10/2026): os números da operação, por cidade, estado ou país. */
export default async function AdminOperationsPage({ searchParams }: PageProps<"/admin/operations">) {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  if (!user.is_admin) redirect("/");
  const t = await getTranslations("adminOperations");
  const tType = await getTranslations("equipmentType");
  const format = await getFormatter();

  const { r } = await searchParams;
  const regionValue = typeof r === "string" && r.trim() ? r.trim() : null;
  const filter = parseFilter(regionValue);
  const [ops, places, demand] = await Promise.all([
    loadOperations(filter),
    supabaseConfigured() ? listPlaces() : EXAMPLE_PLACES,
    loadTripDemand(filter),
  ]);
  const options = regionOptions(places, await getLocale());
  const selected =
    regionValue && (filter.p_city || filter.p_state || filter.p_country)
      ? (options.find((o) => o.value === regionValue) ?? {
          value: regionValue,
          label: filter.p_city ?? filter.p_state ?? filter.p_country ?? "",
          detail: "",
          kind: filter.p_city ? "city" : filter.p_state ? "state" : "country",
        })
      : null;

  const sum = (key: keyof TypeNumbers) => TYPES.reduce((total, type) => total + (ops?.equipment[type]?.[key] ?? 0), 0);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href="/admin" label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">
          {t("subtitle", { time: format.dateTime(new Date(), { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }) })}
        </p>
      </div>

      <RegionPicker options={options} selected={selected} />

      {ops === null ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-base text-hs-black">{t("error")}</p>
      ) : (
        <>
          <section aria-labelledby="ops-people" className="flex flex-col gap-3">
            <h2 id="ops-people" className="text-lg font-semibold text-hs-black">{t("people")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label={t("riders")} value={ops.riders} hint={t("ridersHint")} />
              <Tile label={t("ridersVerified")} value={ops.riders_verified} hint={t("ridersVerifiedHint")} />
              <Tile label={t("hosts")} value={ops.hosts} hint={t("hostsHint")} />
            </div>
          </section>

          <section aria-labelledby="ops-equipment" className="flex flex-col gap-3">
            <h2 id="ops-equipment" className="text-lg font-semibold text-hs-black">{t("equipment")}</h2>
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[480px] text-left text-sm text-hs-black">
                <thead className="bg-surface text-xs text-muted">
                  <tr>
                    <th scope="col" className="px-4 py-3 font-semibold">{t("type")}</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">{t("published")}</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">{t("withDays")}</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">{t("inUse")}</th>
                  </tr>
                </thead>
                <tbody>
                  {TYPES.map((type) => {
                    const row = ops.equipment[type] ?? EMPTY;
                    return (
                      <tr key={type} className="border-t border-line">
                        <th scope="row" className="px-4 py-3 font-medium">{tType(type)}</th>
                        <td className="px-4 py-3 text-right text-base font-semibold">{row.published}</td>
                        <td className="px-4 py-3 text-right text-base font-semibold">{row.with_days}</td>
                        <td className="px-4 py-3 text-right text-base font-semibold">{row.in_use}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-line bg-surface">
                    <th scope="row" className="px-4 py-3 font-semibold">{t("total")}</th>
                    <td className="px-4 py-3 text-right text-base font-bold">{sum("published")}</td>
                    <td className="px-4 py-3 text-right text-base font-bold">{sum("with_days")}</td>
                    <td className="px-4 py-3 text-right text-base font-bold">{sum("in_use")}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <ul className="flex flex-col gap-1 text-xs text-muted">
              <li>{t("publishedHint")}</li>
              <li>{t("withDaysHint")}</li>
              <li>{t("inUseHint")}</li>
            </ul>
          </section>

          <section aria-labelledby="ops-today" className="flex flex-col gap-3">
            <h2 id="ops-today" className="text-lg font-semibold text-hs-black">{t("today")}</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label={t("pickupsToday")} value={ops.pickups_today} hint={t("pickupsTodayHint")} />
            </div>
          </section>

          <section aria-labelledby="ops-trips" className="flex flex-col gap-3">
            <h2 id="ops-trips" className="text-lg font-semibold text-hs-black">{t("trips")}</h2>
            <p className="-mt-2 text-xs text-muted">{t("tripsHint")}</p>
            {demand === null ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-hs-black">{t("error")}</p>
            ) : demand.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{t("tripsEmpty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full min-w-[640px] text-left text-sm text-hs-black">
                  <thead className="bg-surface text-xs text-muted">
                    <tr>
                      <th scope="col" className="px-4 py-3 font-semibold">{t("tripCity")}</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">{t("next7")}</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">{t("next30")}</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">{t("next90")}</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">{t("wantsScooter")}</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">{t("wantsEbike")}</th>
                      <th scope="col" className="px-3 py-3 text-right font-semibold">{t("wantsBoth")}</th>
                      <th scope="col" className="px-4 py-3 text-right font-semibold">{t("tripEquipment")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {demand.map((row) => (
                      <tr key={`${row.city}-${row.city_state}`} className="border-t border-line">
                        <th scope="row" className="px-4 py-3 font-medium">
                          {row.city} <span className="text-muted">- {row.city_state}</span>
                        </th>
                        <td className="px-3 py-3 text-right font-semibold">{row.next7}</td>
                        <td className="px-3 py-3 text-right font-semibold">{row.next30}</td>
                        <td className="px-3 py-3 text-right font-semibold">{row.next90}</td>
                        <td className="px-3 py-3 text-right">{row.wants_scooter}</td>
                        <td className="px-3 py-3 text-right">{row.wants_ebike}</td>
                        <td className="px-3 py-3 text-right">{row.wants_both}</td>
                        <td className={cn("px-4 py-3 text-right font-semibold", row.equipment === 0 && "text-error")}>{row.equipment}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="ops-queues" className="flex flex-col gap-3">
            <h2 id="ops-queues" className="text-lg font-semibold text-hs-black">{t("queues")}</h2>
            <p className="-mt-2 text-xs text-muted">{t("queuesHint")}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Tile label={t("queueListings")} value={ops.queue_listings} href="/admin?tab=listings" />
              <Tile label={t("queueEdits")} value={ops.queue_edits} href="/admin?tab=edits" />
              <Tile label={t("queueIdentity")} value={ops.queue_identity} href="/admin?tab=identity" />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
