import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/app-url";
import { romeToday } from "@/lib/day-ahead-query";
import { listLearnChapters } from "@/lib/learn/db";
import { learnChapterPath } from "@/lib/learn/types";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicSiteUrl();
  const today = romeToday();
  const chapters = await listLearnChapters(false).catch(() => []);

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
      url: `${base}/comunita-energetiche`,
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${base}/cer-stats`,
      lastModified: today,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/learn`,
      lastModified: today,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    ...chapters.map((chapter) => ({
      url: `${base}${learnChapterPath(chapter.slug)}`,
      lastModified: today,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
