import { NEWSROOM_ACTIVE_WINDOW_MS, getNewsroomArticles, newsroomArticleToNewsItem } from "@/lib/newsroom-content";
import type { LivePayload, NewsItem } from "@/lib/live-data";

const HOME_NEWS_LIMIT = 24;
const NEWSROOM_ARCHIVE_LIMIT = 250;
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values());
}

function isActiveNewsItem(item: NewsItem, now = Date.now()) {
  if (!item.publishedAt) return false;
  const timestamp = new Date(item.publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = now - timestamp;
  return ageMs >= -FUTURE_CLOCK_TOLERANCE_MS && ageMs <= NEWSROOM_ACTIVE_WINDOW_MS;
}

function hasArticleSpecificImage(item: NewsItem) {
  return Boolean(item.imageUrl && /^https:\/\//i.test(item.imageUrl));
}

export async function applyLapOnlyNews(payload: LivePayload): Promise<LivePayload> {
  // O reader devolve apenas a janela editorial ativa de 72h, ordenada por relevância.
  const newsroom = (await getNewsroomArticles(NEWSROOM_ARCHIVE_LIMIT)).map(newsroomArticleToNewsItem);
  const newsroomBySport = new Map<string, NewsItem[]>();

  for (const item of newsroom) {
    const current = newsroomBySport.get(item.sportId) ?? [];
    current.push(item);
    newsroomBySport.set(item.sportId, current);
  }

  const sourceNews = payload.feeds
    .flatMap((feed) => feed.news)
    .filter((item) => isActiveNewsItem(item))
    .filter(hasArticleSpecificImage);

  // Conteúdo editorial vindo do CMS também respeita a mesma janela.
  const internalEditorial = payload.editorial
    .filter((item) => item.kind === "editorial")
    .filter((item) => isActiveNewsItem(item))
    .filter(hasArticleSpecificImage);

  const newsroomWithSpecificImages = newsroom
    .filter((item) => isActiveNewsItem(item))
    .filter(hasArticleSpecificImage);

  const homepageNews = uniqueNews([
    ...sourceNews,
    ...newsroomWithSpecificImages,
    ...internalEditorial,
  ])
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, HOME_NEWS_LIMIT);

  return {
    ...payload,
    // Home: notícias recentes com imagem vinculada à própria publicação.
    editorial: homepageNews,
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      // Modalidades: fonte atual primeiro; arquivo LAP entra como complemento.
      news: uniqueNews([
        ...feed.news.filter((item) => isActiveNewsItem(item) && hasArticleSpecificImage(item)),
        ...(newsroomBySport.get(feed.id) ?? []).filter(hasArticleSpecificImage),
      ]),
    })),
  };
}
