import { applyLivePayloadPatch, getLivePayload, ingestLiveWebhook, type LivePayload, type LiveWebhookPatch } from "@/lib/live-data";
import { readLiveCache, writeLiveCache } from "@/lib/live-cache-store";

const LIVE_PAYLOAD_CACHE_KEY = "lap-live-payload-v1";
const SUPABASE_FRESH_TTL_MS = 90_000;
const SUPABASE_STALE_TTL_MS = 6 * 60 * 60_000;
const MEMORY_TTL_MS = 20_000;

let memoryCache: { expiresAt: number; payload: LivePayload } | null = null;

function payloadEventCount(payload: LivePayload) {
  return payload.worldCup.events.length + payload.feeds.reduce((total, feed) => total + feed.scores.length, 0);
}

function cacheAgeMs(cachedAt: string) {
  const timestamp = new Date(cachedAt).getTime();
  return Number.isFinite(timestamp) ? Date.now() - timestamp : Number.POSITIVE_INFINITY;
}

function markPayloadAsStale(payload: LivePayload, note = "Dados preservados do cache gratuito da LAP enquanto a fonte reconecta."): LivePayload {
  return {
    ...payload,
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      sourceStatus: feed.sourceStatus === "live" ? "stale" : feed.sourceStatus,
      sourceNote: feed.sourceNote || note,
    })),
    football: {
      ...payload.football,
      sourceStatus: payload.football.sourceStatus === "live" ? "stale" : payload.football.sourceStatus,
      sourceNote: payload.football.sourceNote || note,
    },
    worldCup: payload.worldCup.sourceStatus === "ok" ? { ...payload.worldCup, sourceStatus: "unavailable" } : payload.worldCup,
  };
}

function shouldKeepStalePayload(fresh: LivePayload, stale: LivePayload) {
  const freshEvents = payloadEventCount(fresh);
  const staleEvents = payloadEventCount(stale);
  if (staleEvents < 4) return false;
  if (freshEvents === 0) return true;
  return freshEvents < Math.max(2, Math.floor(staleEvents * 0.35));
}

export async function getCachedLivePayload(options?: { forceRefresh?: boolean }): Promise<LivePayload> {
  if (!options?.forceRefresh && memoryCache && memoryCache.expiresAt > Date.now()) return memoryCache.payload;

  const persisted = await readLiveCache<LivePayload>(LIVE_PAYLOAD_CACHE_KEY);
  const persistedAge = persisted ? cacheAgeMs(persisted.cachedAt) : Number.POSITIVE_INFINITY;
  if (!options?.forceRefresh && persisted && persistedAge <= SUPABASE_FRESH_TTL_MS) {
    memoryCache = { payload: persisted.payload, expiresAt: Date.now() + MEMORY_TTL_MS };
    return persisted.payload;
  }

  try {
    const fresh = await getLivePayload();
    if (persisted && persistedAge <= SUPABASE_STALE_TTL_MS && shouldKeepStalePayload(fresh, persisted.payload)) {
      const stale = markPayloadAsStale(persisted.payload);
      memoryCache = { payload: stale, expiresAt: Date.now() + MEMORY_TTL_MS };
      return stale;
    }
    await writeLiveCache(LIVE_PAYLOAD_CACHE_KEY, fresh, SUPABASE_FRESH_TTL_MS, "live").catch(() => false);
    memoryCache = { payload: fresh, expiresAt: Date.now() + MEMORY_TTL_MS };
    return fresh;
  } catch (error) {
    if (persisted && persistedAge <= SUPABASE_STALE_TTL_MS) {
      const stale = markPayloadAsStale(persisted.payload);
      memoryCache = { payload: stale, expiresAt: Date.now() + MEMORY_TTL_MS };
      return stale;
    }
    throw error;
  }
}

export async function warmFreeLivePayload() {
  const payload = await getCachedLivePayload({ forceRefresh: true });
  return {
    generatedAt: payload.generatedAt,
    feeds: payload.feeds.length,
    events: payloadEventCount(payload),
    liveFeeds: payload.feeds.filter((feed) => feed.sourceStatus === "live").length,
    staleFeeds: payload.feeds.filter((feed) => feed.sourceStatus === "stale").length,
  };
}

export async function ingestCachedLiveWebhook(patch: LiveWebhookPatch) {
  const current = await getCachedLivePayload();
  const patched = applyLivePayloadPatch(current, patch);
  const accepted = ingestLiveWebhook(patch);

  if (patched.score) {
    memoryCache = { payload: patched.payload, expiresAt: Date.now() + MEMORY_TTL_MS };
    await writeLiveCache(LIVE_PAYLOAD_CACHE_KEY, patched.payload, SUPABASE_FRESH_TTL_MS, "live-webhook").catch(() => false);
  }

  return { ...accepted, ...patched };
}
