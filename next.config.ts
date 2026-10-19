import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// O idioma (PT/EN) vem de um cookie lido a cada visita, então as páginas
// são montadas na hora do pedido. Por isso o modo "Cache Components" fica
// desligado nesta fase.
const nextConfig: NextConfig = {
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
