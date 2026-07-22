import type { MetadataRoute } from "next";
import { getPublishedEditorialArticles } from "@/lib/editorial-store";
import { FOOTBALL_COMPETITIONS, SPORTS } from "@/lib/live-data";
import { getNewsroomArticles } from "@/lib/newsroom-content";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app";
  const [editorial, newsroom] = await Promise.all([
    getPublishedEditorialArticles(250).catch(() => []),
    getNewsroomArticles(250).catch(() => []),
  ]);
  const articles = Array.from(new Map([...newsroom, ...editorial].map((article) => [article.slug, article])).values());
  return [
    { url: `${base}/`, changeFrequency: "always", priority: 1 },
    { url: `${base}/ao-vivo`, changeFrequency: "always", priority: 0.98 },
    { url: `${base}/copa-2026`, changeFrequency: "weekly", priority: 0.82 },
    { url: `${base}/agenda`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/cobertura`, changeFrequency: "weekly", priority: 0.78 },
    { url: `${base}/favoritos`, changeFrequency: "weekly", priority: 0.4 },
    ...SPORTS.map((sport) => ({ url: `${base}/modalidades/${sport.id}`, changeFrequency: "hourly" as const, priority: 0.8 })),
    ...FOOTBALL_COMPETITIONS.map((competition) => ({ url: `${base}/campeonatos/${competition.id}`, changeFrequency: "hourly" as const, priority: 0.75 })),
    ...articles.map((article) => ({ url: `${base}/materias/${article.slug}`, lastModified: article.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
  ];
}
