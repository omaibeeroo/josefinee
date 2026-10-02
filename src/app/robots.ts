import type { MetadataRoute } from "next";
import { appUrl } from "@/config/brand";

export default function robots(): MetadataRoute.Robots {
  const base = appUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/account", "/cart", "/checkout", "/order", "/track", "/api", "/login", "/register"],
      },
    ],
    sitemap: `${base}/sitemap-index.xml`,
  };
}
