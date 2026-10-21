/*
 * Cidades do Brasil (lista oficial de municípios do IBGE, em public/data/br-cities.json,
 * cada item "Nome|UF"). Cidade onde mora e cidade secundária (decisão de 21/10/2026):
 * a pessoa escolhe da lista, então cada cidade vem com o estado.
 * Este arquivo pode ser usado no navegador e no servidor.
 */

export const BR_CITIES_URL = "/data/br-cities.json";

export type ChosenCity = { city: string; uf: string };

/** Valor do campo escondido do formulário: "Mogi Mirim|SP". */
export const cityValue = ({ city, uf }: ChosenCity) => `${city}|${uf}`;

export function parseCityValue(value: string): ChosenCity | null {
  const [city, uf, ...rest] = value.split("|");
  if (rest.length || !city?.trim() || !/^[A-Z]{2}$/.test(uf ?? "")) return null;
  return { city: city.trim(), uf };
}

/** Como a cidade aparece na tela: "Mogi Mirim - SP". */
export const cityLabel = ({ city, uf }: ChosenCity) => `${city} - ${uf}`;
