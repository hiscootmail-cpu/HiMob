import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// O idioma (PT/EN) vem de um cookie lido a cada visita, então as páginas
// são montadas na hora do pedido. Por isso o modo "Cache Components" fica
// desligado nesta fase.
// Código desta versão do site. Na Vercel muda a cada publicação; serve para a
// tela aberta perceber que saiu versão nova e recarregar sozinha (sem precisar
// sair e entrar de novo).
const appVersion = process.env.VERCEL_DEPLOYMENT_ID ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local";

const nextConfig: NextConfig = {
  deploymentId: appVersion === "local" ? undefined : appVersion,
  env: { NEXT_PUBLIC_APP_VERSION: appVersion },
  experimental: {
    serverActions: {
      // Com a Supabase, fotos e documentos vão direto do navegador para o
      // armazenamento; o servidor recebe só textos. O limite cobre a
      // demonstração local (cadastro com frente e verso de até 5 MB cada).
      bodySizeLimit: "12mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

export default withNextIntl(nextConfig);
