import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";

import { BottomNav } from "@/components/bottom-nav";
import { CityGate } from "@/components/city-gate";
import { NewVersionReload } from "@/components/new-version-reload";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { unreadCount } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/session";
import { SITE_URL } from "@/lib/site-url";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

/**
 * Site sempre claro: no modo escuro do celular, o navegador não escurece o
 * cabeçalho, o rodapé nem as telas (decisão de 22/10/2026).
 */
export const viewport: Viewport = {
  colorScheme: "only light",
  themeColor: "#ffffff",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  const locale = await getLocale();

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t("title"), template: `%s | Hi Scoot` },
    description: t("description"),
    // Prévia quando alguém compartilha um link (WhatsApp, redes sociais); a imagem é app/opengraph-image.png.
    openGraph: {
      type: "website",
      siteName: "Hi Scoot",
      title: t("title"),
      description: t("description"),
      locale: locale === "en" ? "en_US" : "pt_BR",
    },
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
  const user = await getCurrentUser();
  const signedIn = user !== null;
  const unread = signedIn ? await unreadCount() : 0;

  return (
    <html lang={locale === "pt" ? "pt-BR" : "en"} className={cn(inter.variable, "h-full")} style={{ colorScheme: "only light" }}>
      <body className="flex min-h-full flex-col bg-hs-white text-hs-black">
        <NextIntlClientProvider>
          <SiteHeader signedIn={signedIn} unreadCount={unread} isAdmin={user?.is_admin ?? false} />
          <main className={cn("flex flex-1 flex-col", signedIn && "pb-16 md:pb-0")}>{children}</main>
          <SiteFooter className={cn(signedIn && "pb-16 md:pb-0")} />
          {signedIn ? <BottomNav /> : null}
          <Toaster />
          {/* Conta sem a cidade onde mora (escolhida da lista): pede antes de continuar. */}
          {user && !user.city_state ? <CityGate /> : null}
          <NewVersionReload />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
