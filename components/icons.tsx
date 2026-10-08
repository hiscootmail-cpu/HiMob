import type { ReactNode, SVGProps } from "react";

/*
 * Os 19 ícones oficiais da Hi Scoot (hiscoot-ui-icon-*).
 * Funcionam como os do Lucide: herdam a cor do texto e aceitam className.
 * Os detalhes preenchidos com cor fixa da paleta são o "acento de marca"
 * de cada ícone e são propositais.
 */

export type IconProps = SVGProps<SVGSVGElement> & {
  /** Texto lido por leitores de tela. Sem título, o ícone é decorativo. */
  title?: string;
};

function Icon({
  title,
  children,
  className,
  ...props
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      {children}
    </svg>
  );
}

export function ScooterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="5" cy="19.5" r="2.3" fill="#35E878" stroke="none" />
      <circle cx="17.5" cy="19.5" r="2.3" fill="#25B9F2" stroke="none" />
      <path d="M7 17.7H15.5" />
      <path d="M7 17.7L5 19.5" />
      <path d="M15.5 17.7L17.5 19.5" />
      <path d="M15.5 17.7L19 3.5" />
      <path d="M16 3.8H22" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="7" />
      <line x1="16.6" y1="16.6" x2="21" y2="21" />
    </Icon>
  );
}

export function ShieldAdminIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.3l7.2 3v5.2c0 5.2-3.2 8.7-7.2 10-4-1.3-7.2-4.8-7.2-10V5.3l7.2-3z" />
      <circle cx="12" cy="9.3" r="1.1" fill="#8157E8" stroke="none" />
      <circle cx="12" cy="12.3" r="1.1" fill="#8157E8" stroke="none" />
      <circle cx="12" cy="15.3" r="1.1" fill="#8157E8" stroke="none" />
    </Icon>
  );
}

/** Estrela de nota fixa (sempre rosa). Para escolher nota, usar a do Lucide. */
export function StarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M12 2.5l2.9 6 6.6.6-5 4.4 1.5 6.5L12 16.9 6 20l1.5-6.5-5-4.4 6.6-.6L12 2.5z"
        fill="#F05AA6"
        stroke="#F05AA6"
        strokeWidth={1.2}
      />
    </Icon>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </Icon>
  );
}

export function VerifiedBadgeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.3l7.2 3v5.2c0 5.2-3.2 8.7-7.2 10-4-1.3-7.2-4.8-7.2-10V5.3l7.2-3z" />
      <path d="M8.6 12.2l2.3 2.3 4.7-4.9" stroke="#25B9F2" />
    </Icon>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.5" y="6" width="19" height="13.5" rx="4" />
      <path d="M2.5 10.5h19" />
      <circle cx="17" cy="14.8" r="1.6" fill="#35E878" stroke="none" />
    </Icon>
  );
}

export function BatteryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2" y="7.5" width="17" height="9" rx="3" />
      <line x1="21.5" y1="10" x2="21.5" y2="14" />
      <rect x="4.2" y="9.6" width="7.4" height="4.8" rx="1.4" fill="#35E878" stroke="none" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2v1.3" />
      <path d="M12 4.6a5.6 5.6 0 0 0-5.6 5.6v2.5c0 1.5-.6 2.8-1.7 3.7h14.6a5.1 5.1 0 0 1-1.7-3.7v-2.5A5.6 5.6 0 0 0 12 4.6z" />
      <path d="M9.9 19a2.2 2.2 0 0 0 4.2 0" />
      <circle cx="18.3" cy="5.3" r="2.1" fill="#F05AA6" stroke="none" />
    </Icon>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="5" width="18" height="16" rx="3.5" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="7.5" y1="2.3" x2="7.5" y2="6.5" />
      <line x1="16.5" y1="2.3" x2="16.5" y2="6.5" />
      <circle cx="8" cy="15.5" r="2" fill="#35E878" stroke="none" />
    </Icon>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M8.5 7l1.3-2h4.4l1.3 2H20a1 1 0 0 1 1 1v9.3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h4.5z" />
      <circle cx="12" cy="13" r="3.3" />
      <circle cx="17.3" cy="9.7" r="1.1" fill="#F05AA6" stroke="none" />
    </Icon>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 6.8A2.8 2.8 0 0 1 6.3 4h11.4a2.8 2.8 0 0 1 2.8 2.8v5.9a2.8 2.8 0 0 1-2.8 2.8H9.3L5 19.2v-3.7h-.4a2.8 2.8 0 0 1-1.1-.2Z" />
      <circle cx="16" cy="9.5" r="1.7" fill="#35E878" stroke="none" />
    </Icon>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.6 2.6L16.2 9.3" />
    </Icon>
  );
}

export function FilterIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <line x1="3" y1="6" x2="21" y2="6" />
      <circle cx="9" cy="6" r="2.2" fill="#35E878" stroke="none" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <circle cx="15" cy="12" r="2.2" fill="#25B9F2" stroke="none" />
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="11" cy="18" r="2.2" fill="#F05AA6" stroke="none" />
    </Icon>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="7" cy="12" r="4" />
      <line x1="11" y1="12" x2="20.5" y2="12" />
      <line x1="16.5" y1="12" x2="16.5" y2="15" />
      <line x1="19.5" y1="12" x2="19.5" y2="14.5" />
      <circle cx="7" cy="12" r="1.3" fill="#8157E8" stroke="none" />
    </Icon>
  );
}

export function LeafIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20C4 10.5 11.5 4 20 4c0 8.5-6.5 16-16 16z" />
      <path d="M4 20C9 15.3 13.5 10.7 19 5.3" />
      <circle cx="6" cy="18" r="1.4" fill="#35E878" stroke="none" />
    </Icon>
  );
}

export function MapPinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 2.3c-4.2 0-7.6 3.4-7.6 7.6 0 5.6 7.6 12.8 7.6 12.8s7.6-7.2 7.6-12.8c0-4.2-3.4-7.6-7.6-7.6z" />
      <circle cx="12" cy="9.9" r="2.6" fill="#25B9F2" stroke="none" />
    </Icon>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </Icon>
  );
}

export function QrCodeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 9V6.5A2.5 2.5 0 0 1 6.5 4H9" />
      <path d="M20 9V6.5A2.5 2.5 0 0 0 17.5 4H15" />
      <path d="M4 15v2.5A2.5 2.5 0 0 0 6.5 20H9" />
      <path d="M20 15v2.5a2.5 2.5 0 0 1-2.5 2.5H15" />
      <circle cx="12" cy="12" r="2.3" fill="#25B9F2" stroke="none" />
    </Icon>
  );
}

/** Lista usada na página de conferência. */
export const officialIcons = {
  scooter: ScooterIcon,
  search: SearchIcon,
  "shield-admin": ShieldAdminIcon,
  star: StarIcon,
  user: UserIcon,
  "verified-badge": VerifiedBadgeIcon,
  wallet: WalletIcon,
  battery: BatteryIcon,
  bell: BellIcon,
  calendar: CalendarIcon,
  camera: CameraIcon,
  chat: ChatIcon,
  "check-circle": CheckCircleIcon,
  filter: FilterIcon,
  key: KeyIcon,
  leaf: LeafIcon,
  "map-pin": MapPinIcon,
  plus: PlusIcon,
  "qr-code": QrCodeIcon,
} as const;

export type OfficialIconName = keyof typeof officialIcons;
