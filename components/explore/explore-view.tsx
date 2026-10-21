"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { List, LoaderCircle, LocateFixed, Map as MapIcon, Plane, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { EquipmentCard } from "@/components/equipment/equipment-card";
import { ScooterIcon, SearchIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/text-field";
import { equipmentTypes, FALLBACK_LOCATION, SEARCH_RADIUS_KM, type Equipment, type EquipmentType } from "@/lib/equipment";
import { cityLabel, type ChosenCity } from "@/lib/br-cities";
import { distanceKm, type LatLng } from "@/lib/geo";
import { cn } from "@/lib/utils";

// O mapa só existe no navegador (Leaflet usa a janela do navegador).
const EquipmentMap = dynamic(() => import("@/components/equipment/equipment-map"), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-line" />,
});

type LocationState = "fallback" | "locating" | "granted" | "denied";
type TypeFilter = "all" | EquipmentType;

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Home: busca com lista e mapa lado a lado no computador; no celular, alterna por botão. */
export function ExploreView({ items, travelCity = null }: { items: Equipment[]; travelCity?: ChosenCity | null }) {
  const t = useTranslations("explore");
  const tType = useTranslations("equipmentType");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [location, setLocation] = useState<LatLng>(FALLBACK_LOCATION);
  const [locationState, setLocationState] = useState<LocationState>("fallback");
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  // Em viagem: começa mostrando só a cidade da viagem (a pessoa pode tirar o filtro).
  const [cityFilter, setCityFilter] = useState<ChosenCity | null>(travelCity);

  /*
   * Sem busca: equipamentos até 5 km; se não houver nenhum por perto, mostra
   * os mais próximos (de qualquer cidade). Com busca (ex.: "Mogi Mirim"):
   * procura em todas as cidades, do mais perto para o mais longe.
   */
  const { results, mode, center } = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    const inCity = cityFilter ? items.filter((item) => normalize(item.city.trim()) === normalize(cityFilter.city)) : items;
    // Na cidade da viagem, o mapa centraliza nos equipamentos de lá (sem usar a localização da pessoa).
    const travelCenter =
      cityFilter && inCity.length && locationState !== "granted"
        ? {
            latitude: inCity.reduce((sum, item) => sum + item.latitude, 0) / inCity.length,
            longitude: inCity.reduce((sum, item) => sum + item.longitude, 0) / inCity.length,
          }
        : null;
    const from = travelCenter ?? location;
    const matches = inCity
      .map((item) => ({ item, km: distanceKm(from, item) }))
      .filter(({ item }) => typeFilter === "all" || item.type === typeFilter)
      .filter(({ item }) => {
        if (words.length === 0) return true;
        const haystack = normalize(`${item.title} ${item.area} ${item.city} ${tType(item.type)}`);
        return words.every((word) => haystack.includes(word));
      })
      .sort((a, b) => a.km - b.km);
    if (words.length) return { results: matches, mode: "search" as const, center: from };
    if (cityFilter) return { results: matches, mode: "city" as const, center: from };
    const near = matches.filter(({ km }) => km <= SEARCH_RADIUS_KM);
    return near.length || !matches.length
      ? { results: near, mode: "near" as const, center: from }
      : { results: matches, mode: "nearest" as const, center: from };
  }, [items, location, locationState, query, typeFilter, tType, cityFilter]);

  function locateMe() {
    if (!("geolocation" in navigator)) {
      setLocationState("denied");
      return;
    }
    setLocationState("locating");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationState("granted");
      },
      () => {
        setLocation(FALLBACK_LOCATION);
        setLocationState("denied");
      },
      { timeout: 10000 },
    );
  }

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setCityFilter(null);
  }

  const showDistance = locationState === "granted";
  const filters: TypeFilter[] = ["all", ...equipmentTypes];

  return (
    <div className="flex flex-1 flex-col">
      <section aria-labelledby="explore-title" className="border-b border-line bg-hs-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
          <h1 id="explore-title" className="text-2xl font-bold text-hs-black">
            {t("title")}
          </h1>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t("searchPlaceholder")}
              aria-label={t("searchLabel")}
              className="rounded-full pl-12"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label={t("typeFilterLabel")} className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                const active = typeFilter === filter;
                return (
                  <button
                    key={filter}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTypeFilter(filter)}
                    className={cn(
                      "h-9 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40",
                      active
                        ? "border-hs-black bg-hs-black text-hs-white"
                        : "border-line bg-hs-white text-hs-black hover:bg-surface",
                    )}
                  >
                    {filter === "all" ? t("filterAll") : tType(filter)}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={locateMe}
              disabled={locationState === "locating"}
              className="ml-auto"
            >
              {locationState === "locating" ? <LoaderCircle className="animate-spin" aria-hidden /> : <LocateFixed aria-hidden />}
              {t("nearMe")}
            </Button>
          </div>
          {cityFilter ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-hs-black">
              <span className="inline-flex h-9 items-center gap-2 rounded-full bg-hs-black pr-1 pl-3 font-semibold text-hs-white">
                <Plane aria-hidden className="size-4" />
                {t("travelChip", { city: cityLabel(cityFilter) })}
                <button
                  type="button"
                  onClick={() => setCityFilter(null)}
                  aria-label={t("travelClear")}
                  className="flex size-7 cursor-pointer items-center justify-center rounded-full outline-none hover:bg-hs-white/20 focus-visible:ring-2 focus-visible:ring-hs-white"
                >
                  <X aria-hidden className="size-4" />
                </button>
              </span>
            </div>
          ) : null}
          <p role="status" className="text-sm text-muted">
            {mode === "city"
              ? t("travelShowing", { city: cityFilter?.city ?? "" })
              : mode === "search"
              ? t("searchAllCities")
              : mode === "nearest"
                ? t("showingNearest", { km: SEARCH_RADIUS_KM })
                : locationState === "granted"
                  ? t("locationGranted", { km: SEARCH_RADIUS_KM })
                  : locationState === "denied"
                    ? t("locationDenied", { km: SEARCH_RADIUS_KM })
                    : t("locationFallback", { km: SEARCH_RADIUS_KM })}{" "}
            · {t("resultCount", { count: results.length })}
          </p>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6 md:px-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section
          aria-label={t("listLabel")}
          className={cn("flex flex-col gap-3 px-4 py-4 md:px-0", mobileView === "map" && "hidden md:flex")}
        >
          {results.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-line bg-hs-white px-6 py-10 text-center">
              <ScooterIcon className="size-10 text-muted" />
              <h2 className="text-base font-semibold text-hs-black">
                {mode === "city" ? t("travelEmptyTitle", { city: cityFilter?.city ?? "" }) : t("emptyTitle")}
              </h2>
              <p className="text-sm text-muted">{mode === "city" ? t("travelEmptyText", { button: t("clearFilters") }) : t("emptyText")}</p>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                {t("clearFilters")}
              </Button>
            </div>
          ) : (
            results.map(({ item, km }) => (
              <EquipmentCard
                key={item.id}
                item={item}
                distanceKm={showDistance ? km : null}
                highlighted={item.id === highlightedId}
                onHover={setHighlightedId}
              />
            ))
          )}
        </section>

        <section
          aria-label={t("mapLabel")}
          className={cn(
            "h-[65dvh] md:sticky md:top-16 md:h-[calc(100dvh-5rem)] md:py-4",
            mobileView === "list" && "hidden md:block",
          )}
        >
          <div className="size-full overflow-hidden md:rounded-lg md:border md:border-line">
            <EquipmentMap
              items={results.map(({ item }) => item)}
              center={center}
              userLocation={locationState === "granted" ? location : null}
              highlightedId={highlightedId}
              onHover={setHighlightedId}
            />
          </div>
        </section>
      </div>

      {/* No celular: botão flutuante para alternar entre lista e mapa. */}
      <div className="pointer-events-none sticky bottom-4 z-[500] flex justify-center md:hidden">
        <Button
          type="button"
          onClick={() => setMobileView(mobileView === "list" ? "map" : "list")}
          className="pointer-events-auto bg-hs-black text-hs-white shadow-lg hover:brightness-110"
        >
          {mobileView === "list" ? <MapIcon aria-hidden /> : <List aria-hidden />}
          {mobileView === "list" ? t("showMap") : t("showList")}
        </Button>
      </div>
    </div>
  );
}
