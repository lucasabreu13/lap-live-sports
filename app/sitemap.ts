import type { MetadataRoute } from "next";
import { getPublishedEditorialArticles } from "@/lib/editorial-store";
import { FOOTBALL_COMPETITIONS, SPORTS } from "@/lib/live-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lap.local";
  const articles = await getPublishedEditorialArticles(48).catch(() => []);
  return [
    { url: `${base}/`, changeFrequency: "always", priority: 1 },
    { url: `${base}/copa-2026`, changeFrequency: "hourly", priority: 0.95 },
    { url: `${base}/agenda`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/favoritos`, changeFrequency: "weekly", priority: 0.4 },
    ...SPORTS.map((sport) => ({ url: `${base}/modalidades/${sport.id}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...FOOTBALL_COMPETITIONS.map((competition) => ({ url: `${base}/campeonatos/${competition.id}`, changeFrequency: "hourly" as const, priority: 0.75 })),
    ...articles.map((article) => ({ url: `${base}/materias/${article.slug}`, lastModified: article.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
