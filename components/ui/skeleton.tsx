import * as React from "react";

import { cn } from "@/lib/utils";

/** Bloco cinza pulsando, usado no estado "carregando". */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-pulse rounded-md bg-line", className)}
      {...props}
    />
  );
}

export { Skeleton };
