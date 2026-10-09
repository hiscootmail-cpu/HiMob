import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// O idioma (PT/EN) vem de um cookie lido a cada visita, então as páginas
// são montadas na hora do pedido. Por isso o modo "Cache Components" fica
// desligado nesta fase.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Maior envio: anúncio com até 10 fotos de até 10 MB cada + o restante do formulário.
      // PROVISÓRIO: com o Supabase, as fotos vão direto para o armazenamento e este limite volta a cair.
      bodySizeLimit: "101mb",
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
