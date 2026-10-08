// Confere se português e inglês têm exatamente os mesmos textos.
import { readFileSync } from "node:fs";

const load = (locale) => JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));

function keys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) =>
    typeof value === "object" ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`],
  );
}

const pt = new Set(keys(load("pt")));
const en = new Set(keys(load("en")));
const missingEn = [...pt].filter((k) => !en.has(k));
const missingPt = [...en].filter((k) => !pt.has(k));

if (missingEn.length || missingPt.length) {
  if (missingEn.length) console.error("Falta em inglês:", missingEn);
  if (missingPt.length) console.error("Falta em português:", missingPt);
  process.exit(1);
}
console.log(`Traduções OK: ${pt.size} textos em PT e EN.`);
