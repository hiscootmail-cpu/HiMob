import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import {
  CalendarIcon,
  ChatIcon,
  CheckCircleIcon,
  KeyIcon,
  QrCodeIcon,
  SearchIcon,
  StarIcon,
  VerifiedBadgeIcon,
  WalletIcon,
  type IconProps,
} from "@/components/icons";
import { addDays, todayInSaoPaulo } from "@/lib/booking";
import { listRiderBookings } from "@/lib/bookings-db";
import { listConversations } from "@/lib/conversations";
import { listHostBookings } from "@/lib/host";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("dashboard");
  return { title: t("title") };
}

/** No máximo 4 cartões de próximo passo, o mais urgente primeiro. */
const MAX_CARDS = 4;

type NextStep = { key: string; href: string; icon: React.ComponentType<IconProps>; title: string; text: string };

/** Painel inicial: para onde a pessoa vai depois de entrar. */
export default async function DashboardPage() {
  const user = await requireUser();
  const t = await getTranslations("dashboard");
  const format = await getFormatter();
  const today = todayInSaoPaulo();
  const tomorrow = addDays(today, 1);
  const dayLabel = (date: string) =>
    date === today
      ? t("today")
      : date === tomorrow
        ? t("tomorrow")
        : format.dateTime(new Date(`${date}T12:00:00Z`), { day: "numeric", month: "long", timeZone: "UTC" });

  const [riderBookings, hostBookings, conversations] = await Promise.all([
    listRiderBookings(),
    user.is_host ? listHostBookings() : Promise.resolve([]),
    listConversations(),
  ]);

  const steps: NextStep[] = [];
  if (user.identity !== "approved") {
    steps.push({ key: "identity", href: "/verify-identity", icon: VerifiedBadgeIcon, title: t("cards.identityTitle"), text: t("cards.identityText") });
  }
  const requests = hostBookings.filter((b) => b.status === "pending");
  if (requests.length) {
    steps.push({ key: "requests", href: "/host/reservations", icon: KeyIcon, title: t("cards.requestsTitle", { count: requests.length }), text: t("cards.requestsText") });
  }
  for (const b of riderBookings.filter((b) => b.status === "accepted")) {
    steps.push({ key: `pay-${b.id}`, href: `/rider/reservations/${b.id}/payment`, icon: WalletIcon, title: t("cards.payTitle"), text: t("cards.payText", { title: b.equipment.title }) });
  }
  for (const b of riderBookings.filter((b) => b.status === "confirmed" && b.start_date <= tomorrow)) {
    steps.push({ key: `pickup-${b.id}`, href: `/rider/reservations/${b.id}`, icon: QrCodeIcon, title: t("cards.pickupTitle", { day: dayLabel(b.start_date), time: b.pickup_time }), text: t("cards.pickupText", { title: b.equipment.title }) });
  }
  for (const b of hostBookings.filter((b) => b.status === "confirmed" && b.start_date <= tomorrow)) {
    steps.push({ key: `handover-${b.id}`, href: `/host/reservations#${b.id}`, icon: CalendarIcon, title: t("cards.handoverTitle", { day: dayLabel(b.start_date), time: b.pickup_time }), text: t("cards.handoverText", { title: b.equipment.title, name: b.rider.full_name }) });
  }
  for (const b of riderBookings.filter((b) => b.status === "completed" && !b.rider_reviewed)) {
    steps.push({ key: `review-${b.id}`, href: `/rider/reservations/${b.id}/review`, icon: StarIcon, title: t("cards.reviewTitle"), text: t("cards.reviewText", { title: b.equipment.title }) });
  }
  const unread = conversations.reduce((sum, c) => sum + c.unread, 0);
  if (unread) {
    steps.push({ key: "messages", href: "/conversations", icon: ChatIcon, title: t("cards.messagesTitle", { count: unread }), text: t("cards.messagesText") });
  }
  const shown = steps.slice(0, MAX_CARDS);

  const shortcuts = [
    { href: "/", icon: SearchIcon, label: t("shortcuts.explore") },
    { href: "/rider/reservations", icon: CalendarIcon, label: t("shortcuts.reservations") },
    { href: user.is_host ? "/host/equipment" : "/host/equipment/new", icon: KeyIcon, label: user.is_host ? t("shortcuts.myListings") : t("shortcuts.becomeHost") },
    { href: "/conversations", icon: ChatIcon, label: t("shortcuts.conversations") },
  ];

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("hello", { name: user.full_name.split(" ")[0] })}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>

      <section aria-labelledby="next-title" className="flex flex-col gap-3">
        <h2 id="next-title" className="text-lg font-semibold text-hs-black">
          {t("nextTitle")}
        </h2>
        {shown.length ? (
          <ul className="flex flex-col gap-3">
            {shown.map(({ key, href, icon: Icon, title, text }, index) => (
              <li key={key}>
                <Link
                  href={href}
                  className={
                    index === 0
                      ? "flex items-center gap-4 rounded-lg border-2 border-hs-green bg-green-soft p-4 outline-none hover:bg-green-soft/70 focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                      : "flex items-center gap-4 rounded-lg border border-line bg-hs-white p-4 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
                  }
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-hs-white text-hs-black">
                    <Icon className="size-6" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-base font-semibold text-hs-black">{title}</span>
                    <span className="text-sm text-muted">{text}</span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-hs-black" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-line p-4">
            <CheckCircleIcon className="size-6 shrink-0 text-on-green" />
            <div className="flex flex-col">
              <p className="text-base font-semibold text-hs-black">{t("allDoneTitle")}</p>
              <p className="text-sm text-muted">{t("allDoneText")}</p>
            </div>
          </div>
        )}
      </section>

      <nav aria-labelledby="shortcuts-title" className="flex flex-col gap-3">
        <h2 id="shortcuts-title" className="text-lg font-semibold text-hs-black">
          {t("shortcutsTitle")}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shortcuts.map(({ href, icon: Icon, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col items-center gap-2 rounded-lg border border-line bg-hs-white p-4 text-center text-sm font-semibold text-hs-black outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40"
              >
                <Icon className="size-7" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
