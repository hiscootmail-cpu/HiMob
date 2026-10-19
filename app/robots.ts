import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

/** O Google pode ler a busca e os anúncios; as áreas da conta ficam de fora. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/auth/",
        "/conversations",
        "/dashboard",
        "/design-system",
        "/host/",
        "/mercado-pago/",
        "/notifications",
        "/profile/edit",
        "/rider/",
        "/settings",
        "/verify-identity",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
