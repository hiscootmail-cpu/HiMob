"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type StarRatingProps = {
  name: string;
  legend: string;
  error?: string;
  onChange?: (value: number) => void;
};

/**
 * Escolha de nota de 1 a 5 estrelas.
 * Usa a estrela do Lucide (e não a oficial, que tem cor fixa) porque aqui ela
 * precisa mudar de cor conforme a escolha. Por baixo são botões de opção,
 * então funciona com teclado e leitor de tela.
 */
export function StarRating({ name, legend, error, onChange }: StarRatingProps) {
  const t = useTranslations("rider.review");
  const [value, setValue] = useState(0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="mb-1 text-base font-semibold text-hs-black">{legend}</legend>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            onMouseEnter={() => setHover(n)}
            className="cursor-pointer rounded-md p-1 has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-hs-blue/40"
          >
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => {
                setValue(n);
                onChange?.(n);
              }}
              className="sr-only"
              aria-label={t("starsLabel", { count: n })}
            />
            <Star
              aria-hidden
              className={cn("size-9 transition-colors", n <= shown ? "fill-hs-pink text-hs-pink" : "fill-transparent text-line")}
            />
          </label>
        ))}
      </div>
      <p className="text-sm text-muted" aria-live="polite">
        {value ? t(`scale.${value}` as "scale.1") : t("chooseStars")}
      </p>
      {error ? (
        <p role="alert" className="text-sm text-error">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
