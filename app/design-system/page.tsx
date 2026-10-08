import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getTranslations } from "next-intl/server";

import { BottomNav } from "@/components/bottom-nav";
import { CheckCircleIcon, officialIcons, ScooterIcon, StarIcon } from "@/components/icons";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { DialogDemo, ToastDemo } from "./demos";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("designSystem");
  return { title: t("title"), robots: { index: false } };
}

const palette = [
  { token: "hs-green", hex: "#35E878", official: true },
  { token: "hs-blue", hex: "#25B9F2", official: true },
  { token: "hs-black", hex: "#171717", official: true },
  { token: "hs-white", hex: "#FFFFFF", official: true },
  { token: "hs-pink", hex: "#F05AA6", official: true },
  { token: "hs-purple", hex: "#8157E8", official: true },
  { token: "danger", hex: "#E53E3E", official: true },
  { token: "surface", hex: "#F5F5F5", official: false },
  { token: "line", hex: "#E5E5E5", official: false },
  { token: "muted", hex: "#5C5C5C", official: false },
] as const;

const buttonVariants = ["primary", "secondary", "outline", "ghost", "destructive", "link"] as const;
const buttonSizes = ["sm", "default", "lg"] as const;

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="flex scroll-mt-20 flex-col gap-4 border-t border-line pt-10">
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-hs-black">{title}</h2>
        {description ? <p className="max-w-3xl text-base text-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StateLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold tracking-wide text-muted uppercase">{children}</p>;
}

export default async function DesignSystemPage() {
  const t = await getTranslations("designSystem");
  const format = await getFormatter();
  const examplePrice = format.number(45, { style: "currency", currency: "BRL" });

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-10 sm:px-6">
      <header className="flex flex-col gap-2">
        <Badge tone="highlight">{t("badge")}</Badge>
        <h1 className="text-3xl font-bold text-hs-black sm:text-4xl">{t("title")}</h1>
        <p className="max-w-3xl text-lg text-muted">{t("intro")}</p>
      </header>

      <Section id="colors" title={t("colors.title")} description={t("colors.description")}>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {palette.map(({ token, hex, official }) => (
            <li key={token} className="flex flex-col overflow-hidden rounded-lg border border-line bg-hs-white">
              <span className="h-16 w-full border-b border-line" style={{ backgroundColor: hex }} />
              <span className="flex flex-col gap-1 p-3">
                <span className="text-sm font-semibold text-hs-black">{t(`colors.names.${token}`)}</span>
                <span className="font-mono text-xs text-muted">{hex}</span>
                <Badge tone={official ? "success" : "pending"}>
                  {official ? t("colors.official") : t("colors.proposal")}
                </Badge>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="type" title={t("type.title")} description={t("type.description")}>
        <div className="flex flex-col gap-3 rounded-lg border border-line p-5">
          <p className="text-4xl font-bold text-hs-black">{t("type.sampleHeading")}</p>
          <p className="text-xl font-semibold text-hs-black">{t("type.sampleSubheading")}</p>
          <p className="text-base text-hs-black">{t("type.sampleBody")}</p>
          <p className="text-sm text-muted">{t("type.sampleSmall")}</p>
        </div>
      </Section>

      <Section id="icons" title={t("icons.title")} description={t("icons.description")}>
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
          {Object.entries(officialIcons).map(([name, Icon]) => (
            <li
              key={name}
              className="flex flex-col items-center gap-2 rounded-lg border border-line bg-hs-white p-4 text-hs-black"
            >
              <Icon className="size-8" />
              <span className="text-center text-xs text-muted">{name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="buttons" title={t("buttons.title")} description={t("buttons.description")}>
        <div className="flex flex-col gap-6">
          {buttonVariants.map((variant) => (
            <div key={variant} className="flex flex-col gap-2">
              <StateLabel>{t(`buttons.variants.${variant}`)}</StateLabel>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant={variant}>{t("buttons.normal")}</Button>
                <Button variant={variant} disabled>
                  {t("buttons.disabled")}
                </Button>
                <Button variant={variant} loading>
                  {t("buttons.loading")}
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-col gap-2">
            <StateLabel>{t("buttons.sizes")}</StateLabel>
            <div className="flex flex-wrap items-center gap-3">
              {buttonSizes.map((size) => (
                <Button key={size} size={size}>
                  {t(`buttons.size.${size}`)}
                </Button>
              ))}
              <Button size="icon" aria-label={t("buttons.iconOnly")}>
                <ScooterIcon />
              </Button>
              <Button>
                <CheckCircleIcon />
                {t("buttons.withIcon")}
              </Button>
            </div>
          </div>
        </div>
      </Section>

      <Section id="fields" title={t("fields.title")} description={t("fields.description")}>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField label={t("fields.nameLabel")} placeholder={t("fields.namePlaceholder")} />
          <TextField
            label={t("fields.emailLabel")}
            type="email"
            placeholder={t("fields.emailPlaceholder")}
            hint={t("fields.emailHint")}
          />
          <TextField
            label={t("fields.priceLabel")}
            inputMode="decimal"
            defaultValue="0"
            error={t("fields.priceError")}
          />
          <TextField label={t("fields.disabledLabel")} defaultValue={t("fields.disabledValue")} disabled />
        </div>
      </Section>

      <Section id="cards" title={t("cards.title")} description={t("cards.description")}>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <StateLabel>{t("cards.loaded")}</StateLabel>
            <Card>
              <div className="flex items-start justify-between gap-3">
                <CardTitle>{t("cards.exampleTitle")}</CardTitle>
                <Badge tone="success">{t("badges.approved")}</Badge>
              </div>
              <CardDescription className="flex items-center gap-1">
                <StarIcon className="size-4" />
                <span className="text-muted">{t("cards.exampleMeta")}</span>
              </CardDescription>
              <p className="text-base font-bold text-hs-black">{t("cards.examplePrice", { price: examplePrice })}</p>
            </Card>
          </div>
          <div className="flex flex-col gap-2">
            <StateLabel>{t("cards.loading")}</StateLabel>
            <Card aria-busy>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-5 w-1/3" />
              <span className="sr-only">{t("cards.loading")}</span>
            </Card>
          </div>
          <div className="flex flex-col gap-2">
            <StateLabel>{t("cards.empty")}</StateLabel>
            <Card className="items-center text-center">
              <ScooterIcon className="size-8 text-muted" />
              <CardTitle className="text-base">{t("cards.emptyTitle")}</CardTitle>
              <CardDescription>{t("cards.emptyText")}</CardDescription>
            </Card>
          </div>
          <div className="flex flex-col gap-2">
            <StateLabel>{t("cards.error")}</StateLabel>
            <Card className="border-danger/40 bg-danger-soft" role="alert">
              <CardTitle className="text-base text-danger">{t("cards.errorTitle")}</CardTitle>
              <CardDescription className="text-hs-black">{t("cards.errorText")}</CardDescription>
              <Button variant="outline" size="sm" className="w-fit">
                {t("cards.retry")}
              </Button>
            </Card>
          </div>
        </div>
      </Section>

      <Section id="badges" title={t("badges.title")} description={t("badges.description")}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="success">{t("badges.approved")}</Badge>
          <Badge tone="info">{t("badges.accepted")}</Badge>
          <Badge tone="pending">{t("badges.inReview")}</Badge>
          <Badge tone="highlight">{t("badges.new")}</Badge>
          <Badge tone="neutral">{t("badges.completed")}</Badge>
          <Badge tone="danger">{t("badges.rejected")}</Badge>
        </div>
      </Section>

      <Section id="toast" title={t("toast.title")} description={t("toast.description")}>
        <ToastDemo />
      </Section>

      <Section id="dialog" title={t("dialog.title")} description={t("dialog.description")}>
        <DialogDemo />
      </Section>

      <Section id="header" title={t("header.title")} description={t("header.description")}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <StateLabel>{t("header.visitor")}</StateLabel>
            <div className="overflow-hidden rounded-lg border border-line">
              <SiteHeader signedIn={false} sticky={false} className="border-b-0" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <StateLabel>{t("header.member")}</StateLabel>
            <div className="overflow-hidden rounded-lg border border-line">
              <SiteHeader signedIn sticky={false} className="border-b-0" />
            </div>
          </div>
        </div>
      </Section>

      <Section id="bottom-nav" title={t("bottomNav.title")} description={t("bottomNav.description")}>
        <div className="mx-auto w-full max-w-md overflow-hidden rounded-lg border border-line">
          <BottomNav fixed={false} className="border-t-0 md:block" />
        </div>
      </Section>

      <Section id="footer" title={t("footer.title")} description={t("footer.description")}>
        <div className="overflow-hidden rounded-lg border border-line">
          <SiteFooter />
        </div>
      </Section>
    </div>
  );
}
