import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuthCardProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
};

/** Moldura das telas de entrada e cadastro: cartão centralizado com título. */
export function AuthCard({ title, description, icon, children, className }: AuthCardProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col gap-6 rounded-lg border border-line bg-hs-white p-6 text-hs-black sm:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-2">
        {icon ? <div className="mb-2 text-hs-black">{icon}</div> : null}
        <h1 className="text-2xl font-bold text-hs-black">{title}</h1>
        {description ? <p className="text-base text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}
