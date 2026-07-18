import type { LivePayload, NewsItem, SportId } from "@/lib/live-data";
import {
  providerLive,
  providerStale,
  providerUnavailable,
  type ProviderResult,
} from "@/lib/providers/provider-types";
import { loadResilientLivePayload } from "@/lib/providers/supabase-cache-provider";

export async function loadGoogleNewsBriefs(sportId: SportId, payload?: LivePayload | null): Promise<ProviderResult<NewsItem[]>> {
  const payloadResult = payload
    ? providerLive(payload, payload.generatedAt)
    : await loadResilientLivePayload();
  const source = payloadResult.data;
  if (!source) return providerUnavailable([], payloadResult.error, "Notícias em atualização.");
  const feed = source.feeds.find((item) => item.id === sportId);
  const news = (feed?.news ?? []).filter((item) => item.kind === "brief");
  if (!news.length) return providerUnavailable([], undefined, "Notícias em atualização.");
  return feed?.sourceStatus === "stale" || payloadResult.status === "stale"
    ? providerStale(news, "Mostrando as notícias mais recentes disponíveis.", source.generatedAt)
    : providerLive(news, source.generatedAt);
}
