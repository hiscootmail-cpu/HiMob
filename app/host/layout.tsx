import { HostTabs } from "@/components/host/host-tabs";

/** Área do Host: abas no topo + conteúdo. */
export default function HostLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <HostTabs />
      {children}
    </div>
  );
}
