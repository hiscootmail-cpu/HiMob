import { ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";

/** Foto do produto da loja. Sem foto, mostra o ícone de sacola (Lucide; não há ícone oficial). */
export function ProductPhoto({ src, alt = "", className }: { src?: string; alt?: string; className?: string }) {
  if (src) {
    return (
      // Fotos vêm do armazenamento da Supabase; tamanhos variados, por isso <img>.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading="lazy" className={cn("bg-purple-soft object-cover", className)} />
    );
  }
  return (
    <div aria-hidden className={cn("flex items-center justify-center bg-purple-soft text-on-purple", className)}>
      <ShoppingBag className="size-1/3 max-h-16" strokeWidth={1.6} />
    </div>
  );
}
