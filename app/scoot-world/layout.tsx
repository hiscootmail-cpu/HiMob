import { WorldTabs } from "@/components/scoot-world/world-tabs";

/** Mundo Scoot: aberto a todas as pessoas, com ou sem cadastro (decisão de 19/10/2026). */
export default function ScootWorldLayout({ children }: LayoutProps<"/scoot-world">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-6 sm:py-8">
      <WorldTabs />
      {children}
    </div>
  );
}
