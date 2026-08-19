import { getCachedLivePayload, refreshCachedLivePayload } from "@/lib/free-live-data";
import { getNewsroomArticles, newsroomArticleToNewsItem } from "@/lib/newsroom-content";
import { toPublicLivePayload } from "@/lib/public-sports";
import type { LivePayload, NewsItem } from "@/lib/live-data";

export const dynamic = "force-dynamic";

const LIVE_REFRESH_TIMEOUT_MS = 40_000;
const CACHE_FALLBACK_TIMEOUT_MS = 5_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  const newsroomWithSpecificImages = newsroom.filter((item) => item.imageUrl && /^https:\/\//i.test(item.imageUrl));
  return {
    ...payload,
    editorial: uniqueNews([...payload.editorial, ...newsroomWithSpecificImages])
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
      .slice(0, 48),
  };
}

async function loadPayload(manualRefresh: boolean) {
  try {
    return await withTimeout(
      manualRefresh ? refreshCachedLivePayload() : getCachedLivePayload(),
      LIVE_REFRESH_TIMEOUT_MS,
      "Tempo limite atingido ao atualizar os dados esportivos.",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/live] primary load failed; trying cached payload", { manualRefresh, error: message });
    return withTimeout(
      getCachedLivePayload({ preferCached: true }),
      CACHE_FALLBACK_TIMEOUT_MS,
      "O cache esportivo também não respondeu dentro do limite.",
    );
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const manualRefresh = url.searchParams.get("refresh") === "1";
  const includeWorldCup = url.searchParams.get("includeWorldCup") === "1";

  try {
    const payload = await loadPayload(manualRefresh);
    const publicPayload = toPublicLivePayload(payload, { includeWorldCup });
    const enrichedPayload = await withNewsroom(publicPayload);

    return Response.json(enrichedPayload, { headers: responseHeaders(manualRefresh) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/live] failed", { manualRefresh, error: message });
    return Response.json(
      { error: "Não foi possível atualizar os dados esportivos agora." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
