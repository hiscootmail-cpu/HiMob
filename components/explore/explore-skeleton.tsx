import { useTranslations } from "next-intl";

import { Skeleton } from "@/components/ui/skeleton";

/** Estado "carregando" da busca. */
export function ExploreSkeleton() {
  const t = useTranslations("explore");

  return (
    <div aria-busy className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-4 sm:px-6">
      <span className="sr-only">{t("loading")}</span>
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-11 w-full rounded-full" />
      <div className="flex gap-2">
        <Skeleton className="h-9 w-20 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-28 rounded-full" />
      </div>
      {[0, 1, 2].map((key) => (
        <div key={key} className="flex gap-4 rounded-lg border border-line p-3">
          <Skeleton className="size-24 shrink-0" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
