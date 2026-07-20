import { applyLivePayloadPatch, getLivePayload, ingestLiveWebhook, type LivePayload, type LiveWebhookPatch, type SportFeed } from "@/lib/live-data";
import { readLiveCache, writeLiveCache, type LiveCacheRecord } from "@/lib/live-cache-store";

const LIVE_PAYLOAD_CACHE_KEY = "lap-live-payload-v1";
const PERSISTED_FRESH_TTL_MS = 90_000;
const PERSISTED_STALE_TTL_MS = 48 * 60 * 60_000;
const MEMORY_TTL_MS = 20_000;
const BACKGROUND_REFRESH_INTERVAL_MS = 60_000;

let memoryCache: { expiresAt: number; payload: LivePayload } | null = null;
let backgroundRefreshInFlight: Promise<void> | null = null;
let lastBackgroundRefreshAt = 0;

function payloadEventCount(payload: LivePayload) {
  return payload.worldCup.events.length + payload.feeds.reduce((total, feed) => total + feed.scores.length, 0);
}

function cacheAgeMs(cachedAt: string) {
  const timestamp = new Date(cachedAt).getTime();
  return Number.isFinite(timestamp) ? Date.now() - timestamp : Number.POSITIVE_INFINITY;
}

function markFeedAsStale(feed: SportFeed, note: string): SportFeed {
  return {
    ...feed,
    sourceStatus: feed.sourceStatus === "live" ? "stale" : feed.sourceStatus,
    sourceNote: note,
  };
}

function markPayloadAsStale(payload: LivePayload, note = "Exibindo a última atualização disponível enquanto buscamos novos dados."): LivePayload {
  return {
    ...payload,
    feeds: payload.feeds.map((feed) => markFeedAsStale(feed, note)),
    football: {
      ...payload.football,
      sourceStatus: payload.football.sourceStatus === "live" ? "stale" : payload.football.sourceStatus,
      sourceNote: note,
    },
    worldCup: payload.worldCup.sourceStatus === "ok" ? { ...payload.worldCup, sourceStatus: "unavailable" } : payload.worldCup,
  };
}

function shouldKeepWholePersistedPayload(fresh: LivePayload, persisted: LivePayload) {
  const freshEvents = payloadEventCount(fresh);
  const persistedEvents = payloadEventCount(persisted);
  if (persistedEvents < 4) return false;
  if (freshEvents === 0) return true;
  return freshEvents < Math.max(2, Math.floor(persistedEvents * 0.35));
}

function mergeFeedWithPersisted(fresh: SportFeed, persisted: SportFeed | null) {
  if (!persisted) return { feed: fresh, usedPersisted: false };

  const preserveScores = fresh.sourceStatus !== "live" && fresh.scores.length === 0 && persisted.scores.length > 0;
  const preserveNews = fresh.sourceStatus !== "live" && fresh.news.length === 0 && persisted.news.length > 0;
  if (!preserveScores && !preserveNews) return { feed: fresh, usedPersisted: false };

  const note = "Alguns dados estão temporariamente atrasados. Mantivemos a última atualização disponível.";
  return {
    feed: {
      ...fresh,
      scores: preserveScores ? persisted.scores : fresh.scores,
      news: preserveNews ? persisted.news : fresh.news,
      sourceStatus: "stale" as const,
      sourceNote: note,
    },
    usedPersisted: true,
  };
}

function mergeWithPersisted(fresh: LivePayload, persisted: LivePayload) {
  if (shouldKeepWholePersistedPayload(fresh, persisted)) {
    return { payload: markPayloadAsStale(persisted), usedPersisted: true };
  }

  let usedPersisted = false;
  const feeds = fresh.feeds.map((feed) => {
    const previous = persisted.feeds.find((item) => item.id === feed.id) ?? null;
    const merged = mergeFeedWithPersisted(feed, previous);
    if (merged.usedPersisted) usedPersisted = true;
    return merged.feed;
  });

  const freshWorldCupUnavailable = fresh.worldCup.events.length === 0 && persisted.worldCup.events.length > 0 && fresh.worldCup.sourceStatus !== "ok";
  if (freshWorldCupUnavailable) usedPersisted = true;

  const footballFeed = feeds.find((feed) => feed.id === "futebol");
  const football = footballFeed
    ? {
        ...fresh.football,
        sourceStatus: footballFeed.sourceStatus,
        sourceNote: footballFeed.sourceNote,
      }
    : fresh.football;

  return {
    payload: {
      ...fresh,
      feeds,
      football,
      worldCup: freshWorldCupUnavailable
        ? { ...persisted.worldCup, sourceStatus: "unavailable" as const }
        : fresh.worldCup,
    },
    usedPersisted,
  };
}

async function refreshFromSources(persisted: LiveCacheRecord<LivePayload> | null) {
  const fresh = await getLivePayload();
  const persistedAge = persisted ? cacheAgeMs(persisted.cachedAt) : Number.POSITIVE_INFINITY;
  const canUsePersisted = Boolean(persisted && persistedAge <= PERSISTED_STALE_TTL_MS);
  const merged = canUsePersisted && persisted ? mergeWithPersisted(fresh, persisted.payload) : { payload: fresh, usedPersisted: false };

  if (!merged.usedPersisted) {
    // O registro precisa sobreviver por toda a janela de fallback. A idade em cached_at
    // decide se ele está fresco; expires_at serve apenas para limpeza do snapshot antigo.
    await writeLiveCache(LIVE_PAYLOAD_CACHE_KEY, fresh, PERSISTED_STALE_TTL_MS, "live").catch(() => false);
  }

  memoryCache = { payload: merged.payload, expiresAt: Date.now() + MEMORY_TTL_MS };
  return merged.payload;
}

export async function getCachedLivePayload(options?: { forceRefresh?: boolean; preferCached?: boolean }): Promise<LivePayload> {
  if (!options?.forceRefresh && memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.payload;

  const persisted = await readLiveCache<LivePayload>(LIVE_PAYLOAD_CACHE_KEY);
  const persistedAge = persisted ? cacheAgeMs(persisted.cachedAt) : Number.POSITIVE_INFINITY;

  if (!options?.forceRefresh && persisted && persistedAge <= PERSISTED_FRESH_TTL_MS) {
    memoryCache = { payload: persisted.payload, expiresAt: Date.now() + MEMORY_TTL_MS };
    return persisted.payload;
  }

  if (!options?.forceRefresh && options?.preferCached && persisted && persistedAge <= PERSISTED_STALE_TTL_MS) {
    const stale = markPayloadAsStale(persisted.payload);
    memoryCache = { payload: stale, expiresAt: Date.now() + MEMORY_TTL_MS };
    return stale;
  }

  try {
    return await refreshFromSources(persisted);
  } catch (error) {
    if (persisted && persistedAge <= PERSISTED_STALE_TTL_MS) {
      const stale = markPayloadAsStale(persisted.payload);
      memoryCache = { payload: stale, expiresAt: Date.now() + MEMORY_TTL_MS };
      return stale;
    }
    throw error;
  }
}

export async function refreshCachedLivePayload() {
  const persisted = await readLiveCache<LivePayload>(LIVE_PAYLOAD_CACHE_KEY);
  return refreshFromSources(persisted);
}

export function refreshCachedLivePayloadInBackground() {
  const now = Date.now();
  if (backgroundRefreshInFlight || now - lastBackgroundRefreshAt < BACKGROUND_REFRESH_INTERVAL_MS) return backgroundRefreshInFlight;
  lastBackgroundRefreshAt = now;
  backgroundRefreshInFlight = refreshCachedLivePayload()
    .then(() => undefined)
    .catch(() => undefined)
    .finally(() => {
      backgroundRefreshInFlight = null;
    });
  return backgroundRefreshInFlight;
}

export async function warmFreeLivePayload() {
  const payload = await refreshCachedLivePayload();
  return {
    generatedAt: payload.generatedAt,
    feeds: payload.feeds.length,
    events: payloadEventCount(payload),
    liveFeeds: payload.feeds.filter((feed) => feed.sourceStatus === "live").length,
    staleFeeds: payload.feeds.filter((feed) => feed.sourceStatus === "stale").length,
  };
}

export async function ingestCachedLiveWebhook(patch: LiveWebhookPatch) {
  const current = await getCachedLivePayload({ preferCached: true });
  const patched = applyLivePayloadPatch(current, patch);
  const accepted = ingestLiveWebhook(patch);

  if (patched.score) {
    memoryCache = { payload: patched.payload, expiresAt: Date.now() + MEMORY_TTL_MS };
    await writeLiveCache(LIVE_PAYLOAD_CACHE_KEY, patched.payload, PERSISTED_STALE_TTL_MS, "live-webhook").catch(() => false);
  }

  return { ...accepted, ...patched };
}
