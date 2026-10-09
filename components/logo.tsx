import Image from "next/image";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";
import logoImage from "@/public/brand/hiscoot-logo.png";

/** Marca escrita "Hi:Scoot", com os dois pontos verdes e o "oo" azul. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-baseline text-2xl font-extrabold tracking-tight text-hs-black", className)}
    >
      <span className="text-hs-black">Hi</span>
      <span className="text-hs-green">:</span>
      <span className="text-hs-black">Sc</span>
      <span className="text-hs-blue">oo</span>
      <span className="text-hs-black">t</span>
    </span>
  );
}

/**
 * Logo oficial: o Scoot (cachorrinho de óculos escuros no patinete) com a marca.
 * É uma imagem, não um desenho vetorial: não usar muito maior que 420 px de altura.
 */
export function LogoFull({ className, priority = false }: { className?: string; priority?: boolean }) {
  const t = useTranslations("brand");

  return (
    <Image
      src={logoImage}
      alt={t("logoAlt")}
      priority={priority}
      className={cn("h-28 w-auto", className)}
      sizes="(max-width: 640px) 160px, 280px"
    />
  );
}

/** Versão para o menu do topo: cachorrinho pequeno + nome escrito, legível em pouco espaço. */
export function Logo({ className }: { className?: string }) {
  const t = useTranslations("brand");

  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src={logoImage} alt="" aria-hidden className="h-11 w-auto" sizes="48px" priority />
      <span aria-hidden>
        <Wordmark />
      </span>
      <span className="sr-only">{t("name")}</span>
    </span>
  );
}
