import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/** Etiqueta de status (ex.: "Aceita", "Em análise", "Concluída"). */
const badgeVariants = cva(
  "inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      tone: {
        success: "bg-green-soft text-on-green",
        info: "bg-blue-soft text-on-blue",
        pending: "bg-pink-soft text-on-pink",
        highlight: "bg-purple-soft text-on-purple",
        neutral: "bg-surface text-hs-black",
        error: "border border-error-line bg-hs-white text-error",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };
