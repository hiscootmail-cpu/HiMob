import { cn } from "@/lib/utils";

/*
 * Marca escrita "Hi:Scoot".
 * PROVISÓRIO: será trocada pela logo oficial com o cachorrinho no patinete
 * (arquivo 003-Hi-Scoot.svg) assim que o arquivo for enviado.
 */
export function Logo({ className }: { className?: string }) {
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
