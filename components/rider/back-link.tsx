import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Link "voltar" do topo das telas internas. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-fit items-center gap-2 rounded-md text-sm font-medium text-hs-black outline-none hover:underline focus-visible:ring-4 focus-visible:ring-hs-blue/40"
    >
      <ArrowLeft className="size-4" aria-hidden />
      {label}
    </Link>
  );
}
