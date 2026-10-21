import "server-only";

import list from "@/public/data/br-cities.json";
import { parseCityValue, type ChosenCity } from "@/lib/br-cities";

const CITIES = new Set<string>(list as string[]);

const plain = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

/**
 * Cidade escrita à mão (cadastros antigos, ex.: "Jaguariuna") → a da lista, se
 * só uma cidade tiver esse nome. Com nome repetido em vários estados, null.
 */
export function findCity(name: string): ChosenCity | null {
  const wanted = plain(name);
  if (!wanted) return null;
  const found = (list as string[]).filter((row) => plain(row.split("|")[0]) === wanted);
  return found.length === 1 ? parseCityValue(found[0]) : null;
}

/** Cidade da lista oficial? Devolve cidade e estado, ou null. */
export function checkCity(value: string): ChosenCity | null {
  const chosen = parseCityValue(value.trim());
  return chosen && CITIES.has(`${chosen.city}|${chosen.uf}`) ? chosen : null;
}

/**
 * Lê um campo de cidade do formulário (CityField). Sem cidade escolhida da lista:
 * "cityRequired" se for obrigatória, ou "cityInvalid" se a pessoa digitou algo sem escolher.
 */
export function readCityField(
  formData: FormData,
  name: string,
  required: boolean,
): { city: ChosenCity | null; error?: "cityRequired" | "cityInvalid" } {
  const value = formData.get(name);
  const typed = formData.get(`${name}Text`);
  const city = typeof value === "string" && value ? checkCity(value) : null;
  if (city) return { city };
  if (typeof value === "string" && value) return { city: null, error: "cityInvalid" };
  if (typeof typed === "string" && typed.trim()) return { city: null, error: "cityInvalid" };
  return required ? { city: null, error: "cityRequired" } : { city: null };
}
