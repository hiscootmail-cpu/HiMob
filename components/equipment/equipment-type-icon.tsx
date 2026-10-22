import { Bike, Waves } from "lucide-react";

import { ScooterIcon } from "@/components/icons";
import type { EquipmentType } from "@/lib/equipment";
import { cn } from "@/lib/utils";

/** Skate elétrico: sem ícone oficial nem no Lucide; desenho no mesmo traço do Lucide. */
function SkateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d="M3 11.5c0 1 .8 1.5 1.8 1.5h14.4c1 0 1.8-.5 1.8-1.5" />
      <path d="M3 11.5 2 10M21 11.5l1-1.5" />
      <circle cx="7" cy="16.5" r="1.8" />
      <circle cx="17" cy="16.5" r="1.8" />
      <path d="M10 8.5h4" />
    </svg>
  );
}

/**
 * Ícone do tipo de equipamento: patinete (ícone oficial), bike elétrica e
 * jetboard (Lucide), skate elétrico (desenho próprio no traço do Lucide).
 */
export function EquipmentTypeIcon({ type, className }: { type: EquipmentType; className?: string }) {
  if (type === "scooter") return <ScooterIcon className={className} />;
  if (type === "eskate") return <SkateIcon className={className} />;
  const Lucide = type === "jetboard" ? Waves : Bike;
  return <Lucide className={cn(className)} aria-hidden strokeWidth={1.8} />;
}
