type SupabaseConfig = { url: string; serviceRoleKey: string };

export type LiveCacheRecord<T> = {
  cacheKey: string;
  payload: T;
  cachedAt: string;
  expiresAt: string;
  sourceStatus: string;
};

type LiveCacheRow = {
  cache_key: string;
  payload: unknown;
  cached_at: string;
  expires_at: string;
  source_status: string;
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

async function liveCacheRequest(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();
  if (!config) return null;
  return fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

function mapRow<T>(row: LiveCacheRow): LiveCacheRecord<T> {
  return {
    cacheKey: row.cache_key,
    payload: row.payload as T,
    cachedAt: row.cached_at,
    expiresAt: row.expires_at,
    sourceStatus: row.source_status,
  };
}

export async function readLiveCache<T>(cacheKey: string): Promise<LiveCacheRecord<T> | null> {
  const key = encodeURIComponent(cacheKey);
  const response = await liveCacheRequest(`lap_live_source_cache?cache_key=eq.${key}&select=cache_key,payload,cached_at,expires_at,source_status&limit=1`, {
    method: "GET",
  }).catch(() => null);
  if (!response?.ok) return null;
  const rows = await response.json().catch(() => []) as LiveCacheRow[];
  const row = rows[0];
  return row ? mapRow<T>(row) : null;
}

export async function writeLiveCache<T>(cacheKey: string, payload: T, ttlMs: number, sourceStatus = "live") {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMs);
  const response = await liveCacheRequest("lap_live_source_cache?on_conflict=cache_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({
      cache_key: cacheKey,
      payload,
      cached_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      source_status: sourceStatus,
    }),
  }).catch(() => null);
  return Boolean(response?.ok);
}

export async function deleteExpiredLiveCache() {
  const response = await liveCacheRequest(`lap_live_source_cache?expires_at=lt.${encodeURIComponent(new Date().toISOString())}`, {
    method: "DELETE",
  }).catch(() => null);
  return Boolean(response?.ok);
}
