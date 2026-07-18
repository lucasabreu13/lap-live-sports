import { getCachedLivePayload } from "@/lib/free-live-data";
import { readLiveCache } from "@/lib/live-cache-store";
import type { LivePayload, ScoreItem, SportId } from "@/lib/live-data";
import {
  providerLive,
  providerStale,
  providerUnavailable,
  type ProviderResult,
} from "@/lib/providers/provider-types";

const LIVE_PAYLOAD_CACHE_KEY = "lap-live-payload-v1";
const MAX_STALE_AGE_MS = 6 * 60 * 60_000;

function eventKey(event: ScoreItem) {
  return `${event.sportId}:${event.id}:${event.isWorldCup ? "world-cup" : "main"}`;
}

function uniqueEvents(events: ScoreItem[]) {
  return Array.from(new Map(events.map((event) => [eventKey(event), event])).values());
}

export function payloadEvents(payload: LivePayload) {
  return uniqueEvents([
    ...payload.worldCup.events,
    ...payload.feeds.flatMap((feed) => feed.scores),
  ]);
}

export async function loadSupabaseCachedPayload(): Promise<ProviderResult<LivePayload | null>> {
  try {
    const record = await readLiveCache<LivePayload>(LIVE_PAYLOAD_CACHE_KEY);
    if (!record) return providerUnavailable(null, undefined, "Histórico recente em atualização.");
    const cachedAt = new Date(record.cachedAt).getTime();
    const age = Number.isFinite(cachedAt) ? Date.now() - cachedAt : Number.POSITIVE_INFINITY;
    if (age > MAX_STALE_AGE_MS) return providerUnavailable(null, undefined, "Histórico recente em atualização.");
    const expiresAt = new Date(record.expiresAt).getTime();
    return Number.isFinite(expiresAt) && expiresAt > Date.now()
      ? providerLive(record.payload, record.cachedAt)
      : providerStale(record.payload, "Mostrando a atualização mais recente disponível.", record.cachedAt);
  } catch (error) {
    return providerUnavailable(null, error, "Histórico recente em atualização.");
  }
}

export async function loadResilientLivePayload(): Promise<ProviderResult<LivePayload | null>> {
  try {
    const payload = await getCachedLivePayload();
    const stale = payload.feeds.some((feed) => feed.sourceStatus === "stale");
    return stale
      ? providerStale(payload, "Mostrando a atualização mais recente disponível.", payload.generatedAt)
      : providerLive(payload, payload.generatedAt);
  } catch (error) {
    return providerUnavailable(null, error, "Conteúdo esportivo em atualização.");
  }
}

export async function findEventInCachedPayload(sportId: SportId, eventId: string, worldCup = false) {
  const direct = await loadSupabaseCachedPayload();
  const resilient = direct.data ? direct : await loadResilientLivePayload();
  if (!resilient.data) return null;
  return payloadEvents(resilient.data).find((event) => (
    event.sportId === sportId &&
    event.id === eventId &&
    (!worldCup || Boolean(event.isWorldCup))
  )) ?? null;
}
