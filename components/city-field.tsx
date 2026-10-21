"use client";

import { Check, MapPin } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useState } from "react";

import { BR_CITIES_URL, cityLabel, cityValue, parseCityValue, type ChosenCity } from "@/lib/br-cities";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;

/** A lista de cidades é baixada uma vez só, quando a pessoa usa o campo. */
let citiesPromise: Promise<ChosenCity[]> | null = null;
function loadCities() {
  citiesPromise ??= fetch(BR_CITIES_URL)
    .then((response) => response.json() as Promise<string[]>)
    .then((rows) => rows.map((row) => parseCityValue(row)).filter((c): c is ChosenCity => c !== null))
    .catch(() => {
      citiesPromise = null;
      return [];
    });
  return citiesPromise;
}

/** "São Paulo" e "sao paulo" são iguais na busca. */
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

type CityFieldProps = {
  /** Nome do campo no formulário (valor "Cidade|UF"; vazio se nada escolhido). */
  name: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: ChosenCity | null;
  /** Chamado quando a pessoa escolhe ou apaga a cidade. */
  onChange?: (city: ChosenCity | null) => void;
};

/**
 * Campo de cidade: a pessoa digita e escolhe da lista oficial (com o estado).
 * Assim "Mogi", "mogi mirim" e "MM" viram a mesma cidade.
 */
export function CityField({ name, label, hint, error, defaultValue = null, onChange }: CityFieldProps) {
  const t = useTranslations("cityField");
  const id = useId();
  const listId = `${id}-list`;
  const messageId = `${id}-message`;
  const [chosen, setChosen] = useState<ChosenCity | null>(defaultValue);
  const [query, setQuery] = useState(defaultValue ? cityLabel(defaultValue) : "");
  const [cities, setCities] = useState<ChosenCity[]>([]);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  const suggestions = useMemo(() => {
    const q = plain(query.replace(/\s+-\s+[A-Za-z]{2}$/, ""));
    if (q.length < 2 || chosen) return [];
    const starts: ChosenCity[] = [];
    const contains: ChosenCity[] = [];
    for (const city of cities) {
      const name = plain(city.city);
      if (name.startsWith(q)) starts.push(city);
      else if (name.includes(q)) contains.push(city);
      if (starts.length >= MAX_SUGGESTIONS) break;
    }
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [cities, query, chosen]);

  const pick = (city: ChosenCity | null) => {
    setChosen(city);
    setQuery(city ? cityLabel(city) : "");
    setOpen(false);
    onChange?.(city);
  };

  const showList = open && suggestions.length > 0;
  const message = error ?? hint;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-hs-black">
        {label}
      </label>
      <div className="relative">
        <MapPin aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted" />
        <input
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${listId}-${highlight}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={message ? messageId : undefined}
          placeholder={t("placeholder")}
          value={query}
          onFocus={() => {
            setOpen(true);
            void loadCities().then(setCities);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
            setOpen(true);
            if (chosen) {
              setChosen(null);
              onChange?.(null);
            }
          }}
          onBlur={() =>
            setTimeout(() => {
              setOpen(false);
              // Digitou o nome exato de uma cidade só: escolhe sozinho.
              if (!chosen) {
                const exact = cities.filter((c) => plain(c.city) === plain(query));
                if (exact.length === 1) pick(exact[0]);
              }
            }, 150)
          }
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
              pick(suggestions[highlight]);
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
          className={cn(
            "h-11 w-full min-w-0 rounded-md border border-line bg-hs-white pr-10 pl-10 text-base text-hs-black transition-colors outline-none placeholder:text-muted",
            "hover:border-hs-black/30 focus-visible:border-hs-blue focus-visible:ring-4 focus-visible:ring-hs-blue/25",
            "aria-invalid:border-error-line aria-invalid:ring-error-line/20",
          )}
        />
        {chosen ? <Check aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2 text-on-green" /> : null}
        {showList ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-md border border-line bg-hs-white py-1 shadow-lg"
          >
            {suggestions.map((city, index) => (
              <li
                key={cityValue(city)}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === highlight}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(city)}
                onMouseEnter={() => setHighlight(index)}
                className={cn("cursor-pointer px-4 py-2.5 text-base text-hs-black", index === highlight && "bg-surface")}
              >
                {city.city} <span className="text-sm text-muted">- {city.uf}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input type="hidden" name={name} value={chosen ? cityValue(chosen) : ""} />
      {/* O que foi digitado sem escolher da lista: o servidor avisa em vez de ignorar. */}
      <input type="hidden" name={`${name}Text`} value={chosen ? "" : query.trim()} />
      {message ? (
        <p id={messageId} className={cn("text-sm", error ? "text-error" : "text-muted")} role={error ? "alert" : undefined}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
