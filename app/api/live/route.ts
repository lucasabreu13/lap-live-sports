import { getCachedLivePayload, refreshCachedLivePayload } from "@/lib/free-live-data";
import { getNewsroomArticles, newsroomArticleToNewsItem } from "@/lib/newsroom-content";
import { toPublicLivePayload } from "@/lib/public-sports";
import type { LivePayload, NewsItem } from "@/lib/live-data";

export const dynamic = "force-dynamic";

function responseHeaders(manualRefresh: boolean): Record<string, string> {
  if (manualRefresh) {
    return { "Cache-Control": "no-store, max-age=0" };
  }
  return {
    "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120, stale-if-error=86400",
    "CDN-Cache-Control": "public, s-maxage=20, stale-while-revalidate=120, stale-if-error=86400",
  };
}

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values());
}

async function withNewsroom(payload: LivePayload): Promise<LivePayload> {
  const newsroom = (await getNewsroomArticles(48)).map(newsroomArticleToNewsItem);
  if (!newsroom.length) return payload;
  return {
    ...payload,
    editorial: uniqueNews([...newsroom, ...payload.editorial]).slice(0, 48),
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      news: uniqueNews([
        ...newsroom.filter((item) => item.sportId === feed.id),
        ...feed.news,
      ]).slice(0, 16),
    })),
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const manualRefresh = url.searchParams.get("refresh") === "1";
  const includeWorldCup = url.searchParams.get("includeWorldCup") === "1";
  try {
    const payload = manualRefresh
      ? await refreshCachedLivePayload()
      : await getCachedLivePayload();
    const publicPayload = toPublicLivePayload(payload, { includeWorldCup });
    const enrichedPayload = await withNewsroom(publicPayload);

    return Response.json(enrichedPayload, { headers: responseHeaders(manualRefresh) });
  } catch {
    return Response.json(
      { error: "Não foi possível atualizar os dados esportivos agora." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
