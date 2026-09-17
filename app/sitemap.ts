import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/app-url";
import { romeToday } from "@/lib/day-ahead-query";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const today = romeToday();

  return [
    {
      url: base,
      lastModified: today,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/offer-compare`,
      lastModified: today,
      changeFrequency: "daily",
      priority: 0.85,
    },
    {
      url: `${base}/learn`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];
}
