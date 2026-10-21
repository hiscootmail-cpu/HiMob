"use client";

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

/** Uma região do filtro: cidade, estado ou país. `value` vai no endereço (?r=). */
export type RegionOption = { value: string; label: string; detail: string; kind: "city" | "state" | "country" };

const MAX_SUGGESTIONS = 8;

/** "São Paulo" e "sao paulo" são iguais na busca. */
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Filtro de região do Painel → Operação: um campo só, com sugestões enquanto a
 * pessoa digita (cabe qualquer número de cidades sem poluir a tela).
 */
export function RegionPicker({ options, selected }: { options: RegionOption[]; selected: RegionOption | null }) {
  const t = useTranslations("adminOperations");
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = plain(query);
    if (!q) return [];
    return options
      .filter((o) => plain(`${o.label} ${o.detail}`).includes(q))
      // Começa com o que foi digitado primeiro; depois países, estados e cidades.
      .sort((a, b) => Number(!plain(a.label).startsWith(q)) - Number(!plain(b.label).startsWith(q)))
      .slice(0, MAX_SUGGESTIONS);
  }, [options, query]);

  const go = (value: string | null) => {
    setQuery("");
    setOpen(false);
    router.push(value ? `/admin/operations?r=${encodeURIComponent(value)}` : "/admin/operations");
  };

  const showList = open && suggestions.length > 0;
  const brazil = options.find((o) => o.value === "country:BR");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
          <input
            type="search"
            role="combobox"
            aria-label={t("searchLabel")}
            aria-expanded={showList}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={showList ? `${listId}-${highlight}` : undefined}
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHighlight(0);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={(event) => {
              if (!showList) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
              } else if (event.key === "Enter") {
                event.preventDefault();
                go(suggestions[highlight].value);
              } else if (event.key === "Escape") {
                setOpen(false);
              }
            }}
            className="h-11 w-full rounded-full border border-line bg-hs-white pr-4 pl-10 text-base text-hs-black outline-none placeholder:text-muted focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          />
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-line bg-hs-white py-1 shadow-lg"
            >
              {suggestions.map((option, index) => (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlight}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => go(option.value)}
                  onMouseEnter={() => setHighlight(index)}
                  className={cn(
                    "flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm text-hs-black",
                    index === highlight && "bg-surface",
                  )}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="truncate text-xs text-muted">
                    {t(`kind.${option.kind}`)}
                    {option.detail ? ` · ${option.detail}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {selected ? null : brazil ? (
          <button
            type="button"
            onClick={() => go(brazil.value)}
            className="inline-flex h-11 shrink-0 items-center rounded-full border border-hs-black/20 bg-hs-white px-4 text-sm font-semibold text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
          >
            {brazil.label}
          </button>
        ) : null}
      </div>
      {open && query.trim() && suggestions.length === 0 ? <p className="text-sm text-muted">{t("noMatch")}</p> : null}
      {selected ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-hs-black">
          <span>{t("showing")}</span>
          <span className="inline-flex h-9 items-center gap-2 rounded-full bg-hs-black pr-1 pl-4 font-semibold text-hs-white">
            {selected.label}
            {selected.detail ? <span className="font-normal opacity-80">· {selected.detail}</span> : null}
            <button
              type="button"
              onClick={() => go(null)}
              aria-label={t("clear")}
              className="flex size-7 items-center justify-center rounded-full outline-none hover:bg-hs-white/20 focus-visible:ring-2 focus-visible:ring-hs-white"
            >
              <X aria-hidden className="size-4" />
            </button>
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("showingAll")}</p>
      )}
    </div>
  );
}
