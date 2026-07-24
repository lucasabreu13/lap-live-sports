import { NEWSROOM_ACTIVE_WINDOW_MS, getNewsroomArticles, newsroomArticleToNewsItem } from "@/lib/newsroom-content";
import type { LivePayload, NewsItem } from "@/lib/live-data";

const HOME_NEWS_LIMIT = 16;
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

export async function applyLapOnlyNews(payload: LivePayload): Promise<LivePayload> {
  // O reader devolve apenas a janela editorial ativa de 72h, ordenada por relevância.
  const newsroom = (await getNewsroomArticles(NEWSROOM_ARCHIVE_LIMIT)).map(newsroomArticleToNewsItem);
  const newsroomBySport = new Map<string, NewsItem[]>();

  for (const item of newsroom) {
    const current = newsroomBySport.get(item.sportId) ?? [];
    current.push(item);
    newsroomBySport.set(item.sportId, current);
  }

  // Conteúdo editorial vindo do CMS também respeita a mesma janela, evitando que
  // uma matéria antiga volte para a home por causa de um cache ou fonte paralela.
  const internalEditorial = payload.editorial
    .filter((item) => item.kind === "editorial")
    .filter((item) => isActiveNewsItem(item));

  const homepageNews = uniqueNews([
    ...newsroom.slice(0, HOME_NEWS_LIMIT),
    ...internalEditorial,
  ]).slice(0, HOME_NEWS_LIMIT);

  return {
    ...payload,
    // Home: principais matérias dos últimos 3 dias, com as novas sempre ganhando espaço.
    editorial: homepageNews,
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      // Modalidades: todo o arquivo autoral ativo daquele esporte dentro das últimas 72h.
      // A URL permanente das matérias mais antigas continua existindo fora da vitrine.
      news: uniqueNews(newsroomBySport.get(feed.id) ?? []),
    })),
  };
}
