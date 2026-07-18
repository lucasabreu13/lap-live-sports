import { getPublishedEditorialArticles } from "@/lib/editorial-store";
import { SPORTS, repairMojibake, type NewsItem, type SportId } from "@/lib/live-data";
import { providerLive, providerUnavailable, type ProviderResult } from "@/lib/providers/provider-types";
import { sportCoverImage } from "@/lib/sport-visuals";

export async function loadEditorialNews(sportId?: SportId, limit = 24): Promise<ProviderResult<NewsItem[]>> {
  try {
    const articles = await getPublishedEditorialArticles(limit);
    const news = articles.flatMap((article) => {
      if (sportId && article.sportId !== sportId) return [];
      if (!SPORTS.some((sport) => sport.id === article.sportId)) return [];
      const visual = sportCoverImage(article.sportId as SportId);
      return [{
        id: `editorial-${article.id}`,
        kind: "editorial" as const,
        slug: article.slug,
        sportId: article.sportId as SportId,
        title: repairMojibake(article.title),
        excerpt: repairMojibake(article.summary),
        source: repairMojibake(article.sourceName || "LAP"),
        url: article.sourceUrl,
        publishedAt: article.publishedAt || article.createdAt,
        internalUrl: `/materias/${article.slug}`,
        imageUrl: article.coverImageUrl || visual.image,
        imageAlt: article.coverImageUrl ? article.title : visual.alt,
      }];
    });
    return news.length
      ? providerLive(news)
      : providerUnavailable([], undefined, "Matérias em preparação.");
  } catch (error) {
    return providerUnavailable([], error, "Matérias em preparação.");
  }
}
