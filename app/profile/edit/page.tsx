import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { ProfileForm } from "@/app/profile/edit/profile-form";
import { BackLink } from "@/components/rider/back-link";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profileEdit");
  return { title: t("title") };
}

/** Editar meu perfil: nome, telefone e cidade. */
export default async function EditProfilePage() {
  const user = await requireUser();
  const t = await getTranslations("profileEdit");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
      <BackLink href={`/profile/${user.id}`} label={t("back")} />
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-hs-black sm:text-3xl">{t("title")}</h1>
        <p className="text-base text-muted">{t("subtitle")}</p>
      </div>
      <ProfileForm
        defaults={{ fullName: user.full_name, phone: user.phone, city: user.city }}
        nameLocked={user.identity === "approved"}
      />
    </div>
  );
}
