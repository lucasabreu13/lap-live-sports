import { getNewsroomArticles, newsroomArticleToNewsItem } from "@/lib/newsroom-content";
import type { LivePayload, NewsItem } from "@/lib/live-data";

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values());
}

export async function applyLapOnlyNews(payload: LivePayload): Promise<LivePayload> {
  const newsroom = (await getNewsroomArticles(120)).map(newsroomArticleToNewsItem);
  const newsroomBySport = new Map<string, NewsItem[]>();

  for (const item of newsroom) {
    const current = newsroomBySport.get(item.sportId) ?? [];
    current.push(item);
    newsroomBySport.set(item.sportId, current);
  }

  const internalEditorial = payload.editorial.filter((item) => item.kind === "editorial");

  return {
    ...payload,
    editorial: uniqueNews([...newsroom, ...internalEditorial]).slice(0, 64),
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      // Modo LAP-only: notícias de terceiros deixam de ser exibidas no produto.
      // Cada modalidade recebe apenas matérias autorais publicadas pela Newsroom.
      news: uniqueNews(newsroomBySport.get(feed.id) ?? []).slice(0, 16),
    })),
  };
}
