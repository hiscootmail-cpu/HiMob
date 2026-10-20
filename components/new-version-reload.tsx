"use client";

import { useEffect } from "react";

const CURRENT = process.env.NEXT_PUBLIC_APP_VERSION;

/**
 * Saiu versão nova do site enquanto a tela estava aberta? Recarrega a página
 * quando a pessoa volta para ela (aba ou app de novo na frente). Assim os
 * botões não ficam presos na versão antiga e ninguém precisa sair e entrar.
 */
export function NewVersionReload() {
  useEffect(() => {
    if (!CURRENT || CURRENT === "local") return;
    let checking = false;
    const check = async () => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        const { version } = (await res.json()) as { version?: string };
        if (version && version !== CURRENT) window.location.reload();
      } catch {
        // Sem internet: confere de novo na próxima volta.
      } finally {
        checking = false;
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);
  return null;
}
