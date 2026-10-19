"use client";

import { useSyncExternalStore } from "react";

import { WORLD_LIMITS, type CartLine } from "@/lib/scoot-world-rules";

/*
 * Carrinho da Loja interna. Fica guardado neste navegador (vale para quem tem
 * conta e para quem não tem). O preço e o estoque de verdade são conferidos
 * pelo servidor na hora de fechar o pedido.
 */

const KEY = "hs_cart";
const EVENT = "hs-cart-change";
const EMPTY: CartLine[] = [];
let cache: { raw: string | null; lines: CartLine[] } = { raw: null, lines: EMPTY };

function read(): CartLine[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cache.raw) return cache.lines;
  let lines: CartLine[] = EMPTY;
  try {
    const parsed = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      lines = parsed
        .filter((l) => typeof l?.id === "string" && Number.isInteger(l?.quantity) && l.quantity > 0)
        .map((l) => ({ id: l.id, quantity: Math.min(l.quantity, WORLD_LIMITS.perItem) }))
        .slice(0, 10);
    }
  } catch {
    lines = EMPTY;
  }
  cache = { raw, lines };
  return lines;
}

function write(lines: CartLine[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(lines));
  } catch {
    // Navegador sem armazenamento (aba anônima): o carrinho vale só nesta página.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useCart() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    lines,
    count: lines.reduce((sum, l) => sum + l.quantity, 0),
    /** Põe no carrinho (soma com o que já estava, até o limite). */
    add: (id: string, quantity: number, max: number) => {
      const current = read();
      const existing = current.find((l) => l.id === id);
      const limit = Math.min(max, WORLD_LIMITS.perItem);
      const next = existing
        ? current.map((l) => (l.id === id ? { ...l, quantity: Math.min(l.quantity + quantity, limit) } : l))
        : [...current, { id, quantity: Math.min(quantity, limit) }];
      write(next);
    },
    setQuantity: (id: string, quantity: number) =>
      write(read().map((l) => (l.id === id ? { ...l, quantity: Math.max(1, Math.min(quantity, WORLD_LIMITS.perItem)) } : l))),
    remove: (id: string) => write(read().filter((l) => l.id !== id)),
    clear: () => write([]),
  };
}
