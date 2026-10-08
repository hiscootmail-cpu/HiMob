import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// O idioma (PT/EN) vem de um cookie lido a cada visita, então as páginas
// são montadas na hora do pedido. Por isso o modo "Cache Components" fica
// desligado nesta fase.
const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Documento de até 5 MB no cadastro + folga para o restante do formulário.
      bodySizeLimit: "6mb",
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
