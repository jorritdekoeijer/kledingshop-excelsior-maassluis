import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/checkout/site-url";

export default function robots(): MetadataRoute.Robots {
  const base = getSiteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/admin/", "/api/", "/login", "/logout"]
    },
    sitemap: `${base}/sitemap.xml`
  };
}
