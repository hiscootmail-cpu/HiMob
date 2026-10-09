import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { BottomNav } from "@/components/bottom-nav";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { unreadCount } from "@/lib/notifications";
import { isSignedIn } from "@/lib/session";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");

  return {
    title: { default: t("title"), template: `%s | Hi Scoot` },
    description: t("description"),
    icons: {
      icon: [
        { url: "/icons/hiscoot-icon-32-light-bg.svg", type: "image/svg+xml", media: "(prefers-color-scheme: light)" },
        { url: "/icons/hiscoot-icon-32-dark-bg.svg", type: "image/svg+xml", media: "(prefers-color-scheme: dark)" },
      ],
      apple: "/icons/hiscoot-icon-180-light-bg.svg",
    },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const signedIn = await isSignedIn();
  const unread = signedIn ? await unreadCount() : 0;

  return (
    <html lang={locale === "pt" ? "pt-BR" : "en"} className={cn(inter.variable, "h-full")}>
      <body className="flex min-h-full flex-col bg-hs-white text-hs-black">
        <NextIntlClientProvider>
          <SiteHeader signedIn={signedIn} unreadCount={unread} />
          <main className={cn("flex flex-1 flex-col", signedIn && "pb-16 md:pb-0")}>{children}</main>
          <SiteFooter className={cn(signedIn && "pb-16 md:pb-0")} />
          {signedIn ? <BottomNav /> : null}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
