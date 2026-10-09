import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { markAllRead } from "@/app/notifications/actions";
import {
  BellIcon,
  CalendarIcon,
  ChatIcon,
  CheckCircleIcon,
  KeyIcon,
  QrCodeIcon,
  StarIcon,
  VerifiedBadgeIcon,
  WalletIcon,
  type IconProps,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { listNotifications, type NotificationKind } from "@/lib/notifications";
import { requireUser } from "@/lib/session";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("notifications");
  return { title: t("title") };
}

const icons: Record<NotificationKind, React.ComponentType<IconProps>> = {
  bookingRequest: KeyIcon,
  bookingAccepted: CheckCircleIcon,
  bookingRejected: CalendarIcon,
  paymentConfirmed: WalletIcon,
  pickupReminder: QrCodeIcon,
  returnConfirmed: CheckCircleIcon,
  reviewReceived: StarIcon,
  listingApproved: CheckCircleIcon,
  listingRejected: KeyIcon,
  documentApproved: VerifiedBadgeIcon,
  documentRejected: VerifiedBadgeIcon,
  newMessage: ChatIcon,
};

/** Notificações: "Todas" ou "Precisam de mim". Cada aviso leva à tela certa. */
export default async function NotificationsPage({ searchParams }: PageProps<"/notifications">) {
  await requireUser();
  const t = await getTranslations("notifications");
  const format = await getFormatter();
  const { filter } = await searchParams;
  const onlyAction = filter === "action";
  const all = await listNotifications();
  const items = onlyAction ? all.filter((n) => n.needs_action) : all;
  const hasUnread = all.some((n) => !n.read);
  const tab = (active: boolean) =>
    cn(
      "flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-hs-blue/40 sm:flex-none",
      active ? "bg-hs-black text-hs-white" : "text-hs-black hover:bg-surface",
    );

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        {hasUnread ? (
          <form action={markAllRead}>
            <Button type="submit" variant="outline" size="sm" className="w-full sm:w-auto">
              {t("markAllRead")}
            </Button>
          </form>
        ) : null}
      </div>

      <nav aria-label={t("filterLabel")} className="flex w-full rounded-full border border-line p-1 sm:w-fit">
        <Link href="/notifications" aria-current={!onlyAction ? "page" : undefined} className={tab(!onlyAction)}>
          {t("filterAll")}
        </Link>
        <Link href="/notifications?filter=action" aria-current={onlyAction ? "page" : undefined} className={tab(onlyAction)}>
          {t("filterAction")}
        </Link>
      </nav>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-line px-6 py-12 text-center">
          <BellIcon className="size-10 text-muted" />
          <h2 className="text-base font-semibold text-hs-black">{onlyAction ? t("emptyActionTitle") : t("emptyTitle")}</h2>
          <p className="text-sm text-muted">{t("emptyText")}</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-lg border border-line bg-hs-white">
          {items.map((n) => {
            const Icon = icons[n.kind];
            return (
              <li key={n.id}>
                <Link
                  href={n.href}
                  className={cn(
                    "flex items-start gap-3 p-4 outline-none hover:bg-surface focus-visible:ring-4 focus-visible:ring-hs-blue/40 focus-visible:ring-inset",
                    !n.read && "bg-green-soft/50",
                  )}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface">
                    <Icon className="size-5" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className={cn("text-base text-hs-black", !n.read ? "font-bold" : "font-medium")}>
                      {!n.read ? <span className="sr-only">{t("unreadLabel")}: </span> : null}
                      {t(`kinds.${n.kind}`, { name: n.name ?? "", title: n.title ?? "" })}
                    </span>
                    <span className="text-xs text-muted">
                      {format.relativeTime(new Date(n.created_at), new Date())}
                      {n.needs_action ? ` · ${t("needsAction")}` : ""}
                    </span>
                  </span>
                  {!n.read ? <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-hs-green" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
