/**
 * Endereço público do site, para o Google e as prévias de links.
 * Troca sozinho quando NEXT_PUBLIC_SITE_URL for configurado com o domínio novo.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://hi-mob.vercel.app").replace(/\/$/, "");
