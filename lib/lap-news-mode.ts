import { getNewsroomArticles, newsroomArticleToNewsItem } from "@/lib/newsroom-content";
import type { LivePayload, NewsItem } from "@/lib/live-data";

const HOME_NEWS_LIMIT = 16;
const NEWSROOM_ARCHIVE_LIMIT = 250;

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values());
}

export async function applyLapOnlyNews(payload: LivePayload): Promise<LivePayload> {
  // O reader já devolve as matérias ordenadas por relevância editorial,
  // combinando atualidade, homepagePriority e boost de breaking news.
  const newsroom = (await getNewsroomArticles(NEWSROOM_ARCHIVE_LIMIT)).map(newsroomArticleToNewsItem);
  const newsroomBySport = new Map<string, NewsItem[]>();

  for (const item of newsroom) {
    const current = newsroomBySport.get(item.sportId) ?? [];
    current.push(item);
    newsroomBySport.set(item.sportId, current);
  }

  const internalEditorial = payload.editorial.filter((item) => item.kind === "editorial");
  const homepageNews = uniqueNews([
    ...newsroom.slice(0, HOME_NEWS_LIMIT),
    ...internalEditorial,
  ]).slice(0, HOME_NEWS_LIMIT);

  return {
    ...payload,
    // Home: somente uma seleção enxuta das matérias mais relevantes da LAP.
    editorial: homepageNews,
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      // Modalidades: preserva todo o arquivo autoral disponível daquele esporte.
      // Notícias externas continuam fora do produto público.
      news: uniqueNews(newsroomBySport.get(feed.id) ?? []),
    })),
  };
}
