import type { ComponentType } from "react";

import {
  CalendarIcon,
  ChatIcon,
  KeyIcon,
  SearchIcon,
  UserIcon,
  type IconProps,
} from "@/components/icons";

/*
 * Itens do menu principal e da barra inferior.
 * PROPOSTA aguardando aprovação: quais itens entram e em que ordem.
 * Os endereços são os já existentes no inventário de ações.
 */
export type NavItem = {
  href: string;
  /** Chave do texto em messages/*.json, dentro de "nav". */
  label: "explore" | "reservations" | "host" | "conversations" | "profile";
  icon: ComponentType<IconProps>;
};

export const navItems: NavItem[] = [
  { href: "/", label: "explore", icon: SearchIcon },
  { href: "/rider/reservations", label: "reservations", icon: CalendarIcon },
  { href: "/host/equipment", label: "host", icon: KeyIcon },
  { href: "/conversations", label: "conversations", icon: ChatIcon },
  { href: "/settings", label: "profile", icon: UserIcon },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
