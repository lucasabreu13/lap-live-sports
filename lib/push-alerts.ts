import { createHash } from "node:crypto";
import { eventDisplayTitle } from "@/lib/event-presentation";
import { getCachedLivePayload } from "@/lib/free-live-data";
import { getGameDetails, type ScoreItem } from "@/lib/live-data";
import {
  disablePushSubscription,
  listActivePushSubscriptions,
  listRecentEventSnapshots,
  reservePushDelivery,
  updatePushDeliveryStatus,
  upsertEventSnapshots,
  type LiveEventSnapshot,
  type PushAlertPreferenceKey,
  type PushPreferences,
  type PushSubscriptionRecord,
} from "@/lib/push-store";
import { canDisplayScore } from "@/lib/score-integrity";
import { isWebPushConfigured, sendWebPush } from "@/lib/web-push";

export type PushAlertType = "reminder_45" | "start" | "score" | "lineup" | "halftime" | "resume" | "final";

export type PushAlert = {
  eventKey: string;
  eventType: PushAlertType;
  eventHash: string;
  preferenceKey: PushAlertPreferenceKey;
  title: string;
  body: string;
  url: string;
};

export type PushMonitorResult = {
  subscriptions: number;
  events: number;
  alerts: number;
  sent: number;
  skippedDuplicates: number;
  expired: number;
  failed: number;
  snapshots: number;
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function slugify(value: string) {
  return normalizeText(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function numericScore(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function hashValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
}

function scoreValue(value: string | null | number | undefined) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
}

function isHalftimeStatus(value: string | null | undefined) {
  if (!value) return false;
  const text = normalizeText(value);
  return text.includes("intervalo") || text.includes("halftime") || text.includes("half-time") || text.includes("intermission");
}

function eventLabel(score: ScoreItem) {
  return eventDisplayTitle(score, "×");
}

function eventUrl(score: ScoreItem) {
  return `/jogos/${score.sportId}/${score.id}${score.isWorldCup ? "?torneio=copa-2026" : ""}`;
}

function scoreLine(score: ScoreItem) {
  if (!canDisplayScore(score)) return eventLabel(score);
  const status = score.status ? ` · ${score.status}` : "";
  return `${score.home.name} ${score.home.score} × ${score.away.score} ${score.away.name}${status}`;
}

export function liveEventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}${score.isWorldCup ? ":cup" : ""}`;
}

export function favoriteMatchesScore(score: ScoreItem, favoriteIds: string[]) {
  const ids = new Set(favoriteIds);
  if (ids.has(`event:${score.sportId}:${score.id}`)) return true;
  if (ids.has(`sport:${score.sportId}`)) return true;
  if (score.competitionId && ids.has(`league:${score.competitionId}`)) return true;
  const homeSlug = slugify(score.home.name);
  const awaySlug = slugify(score.away.name);
  return favoriteIds.some((id) => id.startsWith("team:") && (id.slice(5) === homeSlug || id.slice(5) === awaySlug));
}

export function eventSnapshotFromScore(score: ScoreItem, lineupHash: string | null = null): Omit<LiveEventSnapshot, "updatedAt"> {
  return {
    eventKey: liveEventKey(score),
    sportId: score.sportId,
    eventId: score.id,
    state: score.state,
    integrity: score.integrity,
    status: score.status || null,
    homeScore: scoreValue(score.home.score),
    awayScore: scoreValue(score.away.score),
    timelineHash: null,
    lineupHash,
  };
}

export function alertDeliveryKey(subscriptionId: string, alert: { eventKey: string; eventType: string; eventHash: string }) {
  return `${subscriptionId}:${alert.eventKey}:${alert.eventType}:${alert.eventHash}`;
}

export function pushNotificationTag(alert: { eventKey: string; eventType: string }) {
  const channel = alert.eventType === "score" ? "live" : alert.eventType;
  return `lap-${hashValue([alert.eventKey, channel])}`;
}

function preferenceKeyForType(type: PushAlertType): PushAlertPreferenceKey {
  if (type === "reminder_45") return "preGame";
  if (type === "score") return "score";
  if (type === "lineup") return "lineup";
  if (type === "halftime") return "halftime";
  if (type === "resume") return "resume";
  if (type === "final") return "final";
  return "start";
}

function scoringTitle(score: ScoreItem, previous: LiveEventSnapshot) {
  if (score.sportId !== "futebol") return "LAP · Placar atualizado";
  const previousHome = numericScore(previous.homeScore);
  const previousAway = numericScore(previous.awayScore);
  const currentHome = numericScore(scoreValue(score.home.score));
  const currentAway = numericScore(scoreValue(score.away.score));
  if (previousHome === null || previousAway === null || currentHome === null || currentAway === null) return "LAP · Placar atualizado";
  if (currentHome > previousHome && currentAway === previousAway) return `LAP · Gol do ${score.home.name}`;
  if (currentAway > previousAway && currentHome === previousHome) return `LAP · Gol do ${score.away.name}`;
  return "LAP · Placar atualizado";
}

export function buildPushAlertsForScore(score: ScoreItem, previous: LiveEventSnapshot | null, now = new Date(), lineupHash: string | null = null): PushAlert[] {
  if (score.integrity !== "verified") return [];
  const eventKey = liveEventKey(score);
  const url = eventUrl(score);
  const alerts: PushAlert[] = [];
  const push = (eventType: PushAlertType, title: string, body: string, hashSeed: unknown) => {
    alerts.push({ eventKey, eventType, eventHash: hashValue(hashSeed), preferenceKey: preferenceKeyForType(eventType), title, body, url });
  };

  if (score.state === "pre" && score.startTime) {
    const startsInMinutes = (new Date(score.startTime).getTime() - now.getTime()) / 60_000;
    if (Number.isFinite(startsInMinutes) && startsInMinutes >= 40 && startsInMinutes <= 50) {
      push("reminder_45", "LAP · Jogo começa em 45 minutos", eventLabel(score), ["reminder_45", score.startTime]);
    }
  }

  if (previous && previous.state !== "in" && score.state === "in") push("start", "LAP · A bola rolou", eventLabel(score), ["start", score.state, score.status]);

  if (previous && score.state === "in" && canDisplayScore(score)) {
    const changedScore = previous.homeScore !== scoreValue(score.home.score) || previous.awayScore !== scoreValue(score.away.score);
    if (changedScore && previous.homeScore !== null && previous.awayScore !== null) push("score", scoringTitle(score, previous), scoreLine(score), ["score", score.home.score, score.away.score, score.status]);
  }

  if (previous && score.state === "in" && isHalftimeStatus(score.status) && !isHalftimeStatus(previous.status)) push("halftime", "LAP · Intervalo", scoreLine(score), ["halftime", score.status, score.home.score, score.away.score]);
  if (previous && score.state === "in" && isHalftimeStatus(previous.status) && !isHalftimeStatus(score.status)) push("resume", "LAP · Jogo retomado", scoreLine(score), ["resume", score.status, score.home.score, score.away.score]);
  if (previous && previous.state !== "post" && score.state === "post" && canDisplayScore(score)) push("final", "LAP · Fim de jogo", `${score.home.name} ${score.home.score} × ${score.away.score} ${score.away.name} · placar final`, ["final", score.home.score, score.away.score]);
  if (previous && lineupHash && previous.lineupHash !== lineupHash) push("lineup", "LAP · Escalações confirmadas", `${eventLabel(score)} · veja os titulares`, ["lineup", lineupHash]);

  return alerts;
}

function alertEnabled(preferences: PushPreferences, alert: PushAlert) {
  return preferences.enabled && preferences[alert.preferenceKey] !== false;
}

async function getLineupHashesForEventFavorites(events: ScoreItem[], subscriptions: PushSubscriptionRecord[]) {
  const eventFavoriteIds = new Set(subscriptions.flatMap((subscription) => subscription.favoriteIds.filter((id) => id.startsWith("event:"))));
  const candidates = events.filter((score) => score.integrity === "verified" && eventFavoriteIds.has(`event:${score.sportId}:${score.id}`) && (score.state === "pre" || score.state === "in")).slice(0, 12);
  const pairs = await Promise.all(candidates.map(async (score) => {
    const details = await getGameDetails(score.sportId, score.id, { worldCup: Boolean(score.isWorldCup) }).catch(() => null);
    if (!details?.lineups.length) return null;
    return [liveEventKey(score), hashValue(details.lineups)] as const;
  }));
  return new Map(pairs.filter((pair): pair is readonly [string, string] => pair !== null));
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (index < items.length) {
      const item = items[index];
      index += 1;
      await worker(item);
    }
  });
  await Promise.all(workers);
}

async function dispatchPushAlerts(input: {
  events: ScoreItem[];
  subscriptions: PushSubscriptionRecord[];
  snapshotMap: Map<string, LiveEventSnapshot>;
  lineupHashes?: Map<string, string>;
  now: Date;
}) {
  const events = Array.from(new Map(input.events.map((score) => [liveEventKey(score), score])).values())
    .filter((score) => score.integrity === "verified");
  const nextSnapshots: Array<Omit<LiveEventSnapshot, "updatedAt">> = [];
  const deliveries: Array<{ subscription: PushSubscriptionRecord; alert: PushAlert }> = [];
  const result: PushMonitorResult = {
    subscriptions: input.subscriptions.length,
    events: events.length,
    alerts: 0,
    sent: 0,
    skippedDuplicates: 0,
    expired: 0,
    failed: 0,
    snapshots: 0,
  };

  for (const score of events) {
    const eventKey = liveEventKey(score);
    const lineupHash = input.lineupHashes?.get(eventKey) ?? null;
    const alerts = buildPushAlertsForScore(score, input.snapshotMap.get(eventKey) ?? null, input.now, lineupHash);
    nextSnapshots.push(eventSnapshotFromScore(score, lineupHash));
    if (!alerts.length) continue;

    for (const subscription of input.subscriptions) {
      if (!subscription.enabled || !subscription.preferences.enabled) continue;
      if (!favoriteMatchesScore(score, subscription.favoriteIds)) continue;
      for (const alert of alerts) {
        if (alertEnabled(subscription.preferences, alert)) deliveries.push({ subscription, alert });
      }
    }
  }

  result.alerts = deliveries.length;
  await runWithConcurrency(deliveries, 8, async ({ subscription, alert }) => {
    const reserved = await reservePushDelivery({
      subscriptionId: subscription.id,
      deviceId: subscription.deviceId,
      eventKey: alert.eventKey,
      eventType: alert.eventType,
      eventHash: alert.eventHash,
    });
    if (!reserved) {
      result.skippedDuplicates += 1;
      return;
    }

    const pushResult = await sendWebPush(subscription, {
      title: alert.title,
      body: alert.body,
      url: alert.url,
      tag: pushNotificationTag(alert),
      eventKey: alert.eventKey,
      eventType: alert.eventType,
      renotify: true,
    });
    if (pushResult.ok) {
      result.sent += 1;
      await updatePushDeliveryStatus({ subscriptionId: subscription.id, eventKey: alert.eventKey, eventType: alert.eventType, eventHash: alert.eventHash, status: "sent" });
    } else if (pushResult.expired) {
      result.expired += 1;
      await disablePushSubscription({ deviceId: subscription.deviceId });
      await updatePushDeliveryStatus({ subscriptionId: subscription.id, eventKey: alert.eventKey, eventType: alert.eventType, eventHash: alert.eventHash, status: "expired", errorMessage: pushResult.errorMessage });
    } else {
      result.failed += 1;
      await updatePushDeliveryStatus({ subscriptionId: subscription.id, eventKey: alert.eventKey, eventType: alert.eventType, eventHash: alert.eventHash, status: "failed", errorMessage: pushResult.errorMessage });
    }
  });

  await upsertEventSnapshots(nextSnapshots);
  result.snapshots = nextSnapshots.length;
  return result;
}

export async function runPushMonitor(now = new Date()): Promise<PushMonitorResult> {
  if (!isWebPushConfigured()) throw new Error("VAPID não configurado.");
  const [payload, subscriptions, snapshots] = await Promise.all([
    getCachedLivePayload({ forceRefresh: true }),
    listActivePushSubscriptions(),
    listRecentEventSnapshots(),
  ]);
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.eventKey, snapshot]));
  const allEvents = [...payload.worldCup.events, ...payload.feeds.flatMap((feed) => feed.scores)];
  const events = Array.from(new Map(allEvents.map((score) => [liveEventKey(score), score])).values());
  const lineupHashes = await getLineupHashesForEventFavorites(events, subscriptions);
  return dispatchPushAlerts({ events, subscriptions, snapshotMap, lineupHashes, now });
}

export async function runPushMonitorForEvents(events: ScoreItem[], previousEvents: ScoreItem[] = [], now = new Date()) {
  if (!isWebPushConfigured()) throw new Error("VAPID nÃ£o configurado.");
  const [subscriptions, snapshots] = await Promise.all([listActivePushSubscriptions(), listRecentEventSnapshots()]);
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.eventKey, snapshot]));
  for (const score of previousEvents) {
    const eventKey = liveEventKey(score);
    if (!snapshotMap.has(eventKey)) snapshotMap.set(eventKey, { ...eventSnapshotFromScore(score), updatedAt: now.toISOString() });
  }
  return dispatchPushAlerts({ events, subscriptions, snapshotMap, now });
}
