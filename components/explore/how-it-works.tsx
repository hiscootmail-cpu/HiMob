import Link from "next/link";
import { useTranslations } from "next-intl";

import { CalendarIcon, CheckCircleIcon, QrCodeIcon, SearchIcon, WalletIcon, type IconProps } from "@/components/icons";
import { Button } from "@/components/ui/button";

const STEPS: { key: "find" | "request" | "pay" | "pickup" | "return"; icon: (props: IconProps) => React.ReactNode }[] = [
  { key: "find", icon: SearchIcon },
  { key: "request", icon: CalendarIcon },
  { key: "pay", icon: WalletIcon },
  { key: "pickup", icon: QrCodeIcon },
  { key: "return", icon: CheckCircleIcon },
];

/**
 * "Como funciona" na página inicial, para quem ainda não tem conta (decisão de
 * 22/10/2026): explica o fluxo novo e chama para o cadastro.
 */
export function HowItWorks() {
  const t = useTranslations("howItWorks");
  return (
    <section aria-labelledby="how-title" className="border-b border-line bg-green-soft/40">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 id="how-title" className="text-xl font-bold text-hs-black sm:text-2xl">
            {t("title")}
          </h2>
          <p className="text-base text-hs-black">{t("subtitle")}</p>
        </div>
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(({ key, icon: Icon }, index) => (
            <li key={key} className="flex gap-3 rounded-lg border border-line bg-hs-white p-3 lg:flex-col">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-soft text-hs-black">
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-hs-black">
                  {index + 1}. {t(`steps.${key}.title`)}
                </span>
                <span className="text-sm text-muted">{t(`steps.${key}.text`)}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link href="/auth/sign-up">{t("signUp")}</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/auth/sign-up">{t("becomeHost")}</Link>
          </Button>
          <p className="text-sm text-muted sm:ml-2">
            {t.rich("haveAccount", {
              link: (chunks) => (
                <Link href="/auth/login" className="font-semibold text-hs-black underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
