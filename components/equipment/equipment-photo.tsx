import { Bike } from "lucide-react";

import { ScooterIcon } from "@/components/icons";
import type { EquipmentType } from "@/lib/equipment";
import { cn } from "@/lib/utils";

/*
 * Espaço da foto do equipamento.
 * EM ABERTO: o anúncio ainda não tem campo de foto definido. Até lá, mostra
 * o ícone do tipo (patinete: ícone oficial; bike elétrica: Lucide, sem oficial).
 */
export function EquipmentPhoto({ type, className }: { type: EquipmentType; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("flex items-center justify-center bg-green-soft text-hs-black", className)}
    >
      {type === "scooter" ? <ScooterIcon className="size-1/3 max-h-20" /> : <Bike className="size-1/3 max-h-20" strokeWidth={1.6} />}
    </div>
  );
}
