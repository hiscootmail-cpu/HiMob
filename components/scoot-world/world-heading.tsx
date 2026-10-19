/** Título e frase de cada subpágina do Mundo Scoot. */
export function WorldHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{title}</h1>
      <p className="text-base text-muted">{subtitle}</p>
    </div>
  );
}
