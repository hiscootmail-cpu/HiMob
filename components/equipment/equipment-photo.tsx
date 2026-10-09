import { Bike } from "lucide-react";

import { ScooterIcon } from "@/components/icons";
import type { EquipmentType } from "@/lib/equipment";
import { cn } from "@/lib/utils";

/*
 * Foto do equipamento. Sem foto (dados de exemplo), mostra o ícone do tipo
 * (patinete: ícone oficial; bike elétrica: Lucide, sem oficial).
 */
export function EquipmentPhoto({
  type,
  src,
  alt = "",
  className,
}: {
  type: EquipmentType;
  /** Endereço público da foto (pasta "equipment-photos"). */
  src?: string;
  alt?: string;
  className?: string;
}) {
  if (src) {
    return (
      // Fotos vêm do armazenamento da Supabase; tamanhos variados, por isso <img>.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} loading="lazy" className={cn("bg-green-soft object-cover", className)} />
    );
  }
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center bg-green-soft text-hs-black", className)}
    >
      {type === "scooter" ? <ScooterIcon className="size-1/3 max-h-20" /> : <Bike className="size-1/3 max-h-20" strokeWidth={1.6} />}
    </div>
  );
}
