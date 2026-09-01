import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/app-url";
import { listArchiveDates } from "@/lib/day-archive";
import { archiveDayPath } from "@/lib/market-zones";
import { romeToday } from "@/lib/day-ahead-query";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const today = romeToday();
  let dates: string[] = [];
  try {
    dates = await listArchiveDates();
  } catch {
    dates = [];
  }

  return [
    {
      url: base,
      lastModified: today,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/prezzi`,
      lastModified: today,
      changeFrequency: "daily",
      priority: 0.9,
    },
    ...dates.map((date) => ({
      url: `${base}${archiveDayPath(date)}`,
      lastModified: date,
      changeFrequency: "weekly" as const,
      priority: date >= today ? 0.9 : 0.7,
    })),
  ];
}
