import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/checkout/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getSiteUrl();
  const now = new Date();

  const paths: {
    path: string;
    changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
    priority: number;
  }[] = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/shop", changeFrequency: "weekly", priority: 0.9 },
    { path: "/cart", changeFrequency: "monthly", priority: 0.4 },
    { path: "/contact", changeFrequency: "yearly", priority: 0.5 },
    { path: "/privacy", changeFrequency: "yearly", priority: 0.4 },
    { path: "/algemene-voorwaarden", changeFrequency: "yearly", priority: 0.4 }
  ];

  return paths.map(({ path, changeFrequency, priority }) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency,
    priority
  }));
}
