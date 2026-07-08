import type { ScoreIntegrity } from "@/lib/score-integrity";

export type PushAlertPreferenceKey = "preGame" | "start" | "score" | "lineup" | "halftime" | "resume" | "final" | "editorial";

export type PushPreferences = {
  enabled: boolean;
  favoriteOnly: boolean;
} & Record<PushAlertPreferenceKey, boolean>;

export type PushSubscriptionRecord = {
  id: string;
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  preferences: PushPreferences;
  favoriteIds: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
};

export type LiveEventSnapshot = {
  eventKey: string;
  sportId: string;
  eventId: string;
  state: string;
  integrity: ScoreIntegrity;
  status: string | null;
  homeScore: string | null;
  awayScore: string | null;
  timelineHash: string | null;
  lineupHash: string | null;
  updatedAt: string;
};

export type PushDeliveryStatus = "queued" | "sent" | "failed" | "expired";

type SupabaseConfig = { url: string; serviceRoleKey: string };

type PushSubscriptionRow = {
  id: string;
  device_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  preferences: unknown;
  favorite_ids: unknown;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

type LiveEventSnapshotRow = {
  event_key: string;
  sport_id: string;
  event_id: string;
  state: string;
  integrity: ScoreIntegrity;
  status: string | null;
  home_score: string | null;
  away_score: string | null;
  timeline_hash: string | null;
  lineup_hash: string | null;
  updated_at: string;
};

const SUBSCRIPTION_SELECT = [
  "id", "device_id", "endpoint", "p256dh", "auth", "user_agent", "preferences", "favorite_ids", "enabled", "created_at", "updated_at", "last_seen_at",
].join(",");

const SNAPSHOT_SELECT = [
  "event_key", "sport_id", "event_id", "state", "integrity", "status", "home_score", "away_score", "timeline_hash", "lineup_hash", "updated_at",
].join(",");

export const DEFAULT_PUSH_PREFERENCES: PushPreferences = {
  enabled: false,
  favoriteOnly: true,
  preGame: true,
  start: true,
  score: true,
  lineup: true,
  halftime: true,
  resume: true,
  final: true,
  editorial: true,
};

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

async function supabaseRequest(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Banco de Push não configurado.");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha no banco de Push (${response.status}): ${detail}`);
  }
  return response;
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function normalizePushPreferences(value: unknown): PushPreferences {
  const input = asObject(value);
  const bool = (key: keyof PushPreferences, fallback: boolean) => typeof input[key] === "boolean" ? Boolean(input[key]) : fallback;
  return {
    enabled: bool("enabled", DEFAULT_PUSH_PREFERENCES.enabled),
    favoriteOnly: bool("favoriteOnly", DEFAULT_PUSH_PREFERENCES.favoriteOnly),
    preGame: bool("preGame", DEFAULT_PUSH_PREFERENCES.preGame),
    start: bool("start", DEFAULT_PUSH_PREFERENCES.start),
    score: bool("score", DEFAULT_PUSH_PREFERENCES.score),
    lineup: bool("lineup", DEFAULT_PUSH_PREFERENCES.lineup),
    halftime: bool("halftime", DEFAULT_PUSH_PREFERENCES.halftime),
    resume: bool("resume", DEFAULT_PUSH_PREFERENCES.resume),
    final: bool("final", DEFAULT_PUSH_PREFERENCES.final),
    editorial: bool("editorial", DEFAULT_PUSH_PREFERENCES.editorial),
  };
}

export function sanitizeFavoriteIds(value: unknown) {
  const raw = Array.isArray(value) ? value : [];
  return [...new Set(raw.filter((item): item is string => typeof item === "string" && item.length >= 3 && item.length <= 180))].slice(0, 80);
}

function mapSubscription(row: PushSubscriptionRow): PushSubscriptionRecord {
  return {
    id: row.id,
    deviceId: row.device_id,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    auth: row.auth,
    userAgent: row.user_agent,
    preferences: normalizePushPreferences(row.preferences),
    favoriteIds: sanitizeFavoriteIds(row.favorite_ids),
    enabled: row.enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
  };
}

function mapSnapshot(row: LiveEventSnapshotRow): LiveEventSnapshot {
  return {
    eventKey: row.event_key,
    sportId: row.sport_id,
    eventId: row.event_id,
    state: row.state,
    integrity: row.integrity,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    timelineHash: row.timeline_hash,
    lineupHash: row.lineup_hash,
    updatedAt: row.updated_at,
  };
}

export function isPushStoreConfigured() {
  return Boolean(getSupabaseConfig());
}

export async function upsertPushSubscription(input: {
  deviceId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  preferences: PushPreferences;
  favoriteIds: string[];
}) {
  const response = await supabaseRequest("lap_push_subscriptions?on_conflict=device_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      device_id: input.deviceId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent,
      preferences: { ...input.preferences, enabled: true },
      favorite_ids: input.favoriteIds,
      enabled: true,
      last_seen_at: new Date().toISOString(),
    }),
  });
  const rows = await response.json() as PushSubscriptionRow[];
  if (!rows[0]) throw new Error("Assinatura Push não foi salva.");
  return mapSubscription(rows[0]);
}

export async function updatePushDevicePreferences(input: {
  deviceId: string;
  preferences: PushPreferences;
  favoriteIds: string[];
  enabled?: boolean;
}) {
  const query = new URLSearchParams({ device_id: `eq.${input.deviceId}` });
  const response = await supabaseRequest(`lap_push_subscriptions?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      preferences: { ...input.preferences, enabled: input.enabled ?? input.preferences.enabled },
      favorite_ids: input.favoriteIds,
      enabled: input.enabled ?? input.preferences.enabled,
      last_seen_at: new Date().toISOString(),
    }),
  });
  const rows = await response.json() as PushSubscriptionRow[];
  return rows[0] ? mapSubscription(rows[0]) : null;
}

export async function disablePushSubscription(input: { deviceId?: string; endpoint?: string }) {
  const filters = new URLSearchParams();
  if (input.deviceId) filters.set("device_id", `eq.${input.deviceId}`);
  if (input.endpoint) filters.set("endpoint", `eq.${input.endpoint}`);
  if (!filters.toString()) throw new Error("Informe deviceId ou endpoint.");
  await supabaseRequest(`lap_push_subscriptions?${filters.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ enabled: false, preferences: { ...DEFAULT_PUSH_PREFERENCES, enabled: false } }),
  });
}

export async function listActivePushSubscriptions(limit = 500) {
  const query = new URLSearchParams({
    select: SUBSCRIPTION_SELECT,
    enabled: "eq.true",
    order: "updated_at.desc",
    limit: String(Math.max(1, Math.min(limit, 1000))),
  });
  const response = await supabaseRequest(`lap_push_subscriptions?${query.toString()}`);
  return (await response.json() as PushSubscriptionRow[]).map(mapSubscription);
}

export async function getPushSubscriptionByDevice(deviceId: string) {
  const query = new URLSearchParams({ select: SUBSCRIPTION_SELECT, device_id: `eq.${deviceId}`, enabled: "eq.true", limit: "1" });
  const response = await supabaseRequest(`lap_push_subscriptions?${query.toString()}`);
  const rows = await response.json() as PushSubscriptionRow[];
  return rows[0] ? mapSubscription(rows[0]) : null;
}

export async function listRecentEventSnapshots(hours = 72) {
  const since = new Date(Date.now() - Math.max(1, hours) * 60 * 60_000).toISOString();
  const query = new URLSearchParams({
    select: SNAPSHOT_SELECT,
    updated_at: `gte.${since}`,
    limit: "2000",
  });
  const response = await supabaseRequest(`lap_live_event_snapshots?${query.toString()}`);
  return (await response.json() as LiveEventSnapshotRow[]).map(mapSnapshot);
}

export async function upsertEventSnapshots(snapshots: Array<Omit<LiveEventSnapshot, "updatedAt">>) {
  if (!snapshots.length) return;
  await supabaseRequest("lap_live_event_snapshots?on_conflict=event_key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(snapshots.map((snapshot) => ({
      event_key: snapshot.eventKey,
      sport_id: snapshot.sportId,
      event_id: snapshot.eventId,
      state: snapshot.state,
      integrity: snapshot.integrity,
      status: snapshot.status,
      home_score: snapshot.homeScore,
      away_score: snapshot.awayScore,
      timeline_hash: snapshot.timelineHash,
      lineup_hash: snapshot.lineupHash,
      updated_at: new Date().toISOString(),
    }))),
  });
}

export async function reservePushDelivery(input: {
  subscriptionId: string;
  deviceId: string;
  eventKey: string;
  eventType: string;
  eventHash: string;
}) {
  const response = await supabaseRequest("lap_push_deliveries?on_conflict=subscription_id,event_key,event_type,event_hash", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({
      subscription_id: input.subscriptionId,
      device_id: input.deviceId,
      event_key: input.eventKey,
      event_type: input.eventType,
      event_hash: input.eventHash,
      status: "queued",
    }),
  });
  const rows = await response.json().catch(() => []) as Array<{ id: string }>;
  return Boolean(rows[0]);
}

export async function updatePushDeliveryStatus(input: {
  subscriptionId: string;
  eventKey: string;
  eventType: string;
  eventHash: string;
  status: PushDeliveryStatus;
  errorMessage?: string | null;
}) {
  const query = new URLSearchParams({
    subscription_id: `eq.${input.subscriptionId}`,
    event_key: `eq.${input.eventKey}`,
    event_type: `eq.${input.eventType}`,
    event_hash: `eq.${input.eventHash}`,
  });
  await supabaseRequest(`lap_push_deliveries?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      status: input.status,
      error_message: input.errorMessage ?? null,
      sent_at: new Date().toISOString(),
    }),
  });
}
