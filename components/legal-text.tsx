import type { LegalDocument } from "@/lib/legal/types";
import { cn } from "@/lib/utils";

/** Texto de Termos de Uso ou Política de Privacidade (página e janela do cadastro). */
export function LegalText({ doc, compact = false }: { doc: LegalDocument; compact?: boolean }) {
  const Heading = compact ? "h3" : "h2";
  return (
    <div className={cn("flex flex-col text-hs-black", compact ? "gap-4 text-sm" : "gap-6 text-base")}>
      {doc.intro.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {doc.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-2">
          <Heading className={cn("font-semibold text-hs-black", compact ? "text-sm" : "text-lg")}>{section.title}</Heading>
          {section.paragraphs.map((p) => (
            <p key={p} className="text-hs-black">
              {p}
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}
