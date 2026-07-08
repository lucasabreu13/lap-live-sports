import { getCachedLivePayload } from "@/lib/free-live-data";
import { getResilientGameDetails } from "@/lib/resilient-game-details";
import { FOOTBALL_COMPETITIONS, SPORTS, type ScoreItem } from "@/lib/live-data";

export type SiteAuditStatus = "ok" | "warn" | "fail";

export type SiteAuditItem = {
  type: "route" | "game" | "api" | "article";
  path: string;
  status: SiteAuditStatus;
  httpStatus?: number;
  message: string;
};

export type SiteAuditReport = {
  ok: boolean;
  generatedAt: string;
  checked: number;
  okCount: number;
  warnCount: number;
  failCount: number;
  payload: {
    feeds: number;
    events: number;
    liveFeeds: number;
    staleFeeds: number;
    generatedAt: string;
  };
  items: SiteAuditItem[];
};

function eventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function eventPath(score: ScoreItem) {
  return `/jogos/${score.sportId}/${score.id}${score.isWorldCup ? "?torneio=copa-2026" : ""}`;
}

function scoreTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;
  const time = new Date(score.startTime).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function uniqueEvents(events: ScoreItem[]) {
  return Array.from(new Map(events.map((score) => [eventKey(score), score])).values());
}

function phaseRank(score: ScoreItem) {
  if (score.state === "in") return 0;
  if (score.state === "pre") return 1;
  if (score.state === "post") return 2;
  return 3;
}

function pickEventsForAudit(events: ScoreItem[], maxPerSport: number, deep: boolean) {
  const bySport = new Map<string, ScoreItem[]>();
  for (const event of events) bySport.set(event.sportId, [...(bySport.get(event.sportId) ?? []), event]);
  return [...bySport.values()].flatMap((items) => {
    const sorted = [...items].sort((a, b) => phaseRank(a) - phaseRank(b) || scoreTime(a) - scoreTime(b));
    return sorted.slice(0, deep ? Math.max(maxPerSport, 12) : maxPerSport);
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function fetchWithTimeout(url: string, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "user-agent": "LAP Site Audit/1.0" },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function checkHttpPath(baseUrl: string, path: string, type: SiteAuditItem["type"] = "route"): Promise<SiteAuditItem> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}${path}`);
    if (response.status === 404) return { type, path, status: "fail", httpStatus: response.status, message: "404 found." };
    if (response.status >= 400) return { type, path, status: "warn", httpStatus: response.status, message: `HTTP ${response.status}.` };
    return { type, path, status: "ok", httpStatus: response.status, message: "Route responded." };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route check failed.";
    return { type, path, status: "warn", message };
  }
}

async function checkGame(score: ScoreItem): Promise<SiteAuditItem> {
  const path = eventPath(score);
  const details = await getResilientGameDetails(score.sportId, score.id, { worldCup: Boolean(score.isWorldCup) }).catch(() => null);
  if (!details) return { type: "game", path, status: "fail", message: "Event is in the schedule, but no detail or fallback could be resolved." };
  const hasFallbackOnly = !details.timeline.length && !details.teamStats.length && !details.lineups.length;
  if (hasFallbackOnly) return { type: "game", path, status: "warn", message: "Fallback page active: schedule/cache data is available; detailed source has not published full stats yet." };
  return { type: "game", path, status: "ok", message: "Event page resolves with detailed data." };
}

function articlePaths(payload: Awaited<ReturnType<typeof getCachedLivePayload>>) {
  const seen = new Set<string>();
  return [...payload.editorial, ...payload.feeds.flatMap((feed) => feed.news)]
    .map((item) => item.internalUrl)
    .filter((path) => {
      if (!path || seen.has(path)) return false;
      seen.add(path);
      return true;
    })
    .slice(0, 18);
}

export async function runSiteAudit(options?: { baseUrl?: string; maxPerSport?: number; deep?: boolean }): Promise<SiteAuditReport> {
  const baseUrl = (options?.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app").replace(/\/$/, "");
  const maxPerSport = Math.min(Math.max(options?.maxPerSport ?? 4, 1), 20);
  const deep = Boolean(options?.deep);
  const payload = await getCachedLivePayload({ forceRefresh: true });
  const allEvents = uniqueEvents([...payload.worldCup.events, ...payload.feeds.flatMap((feed) => feed.scores)]);

  const staticPaths = [
    "/",
    "/agenda",
    "/ao-vivo",
    "/copa-2026",
    "/cobertura",
    "/favoritos",
    ...SPORTS.map((sport) => `/modalidades/${sport.id}`),
    ...FOOTBALL_COMPETITIONS.slice(0, deep ? FOOTBALL_COMPETITIONS.length : 8).map((competition) => `/campeonatos/${competition.id}`),
  ];

  const items: SiteAuditItem[] = [];
  for (const paths of chunk(staticPaths, 8)) {
    items.push(...await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path))));
  }

  const apiPaths = ["/api/live", "/api/health"].filter(Boolean);
  for (const paths of chunk(apiPaths, 4)) {
    items.push(...await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "api"))));
  }

  for (const paths of chunk(articlePaths(payload), 6)) {
    items.push(...await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "article"))));
  }

  const sampledEvents = pickEventsForAudit(allEvents, maxPerSport, deep);
  for (const group of chunk(sampledEvents, 4)) {
    items.push(...await Promise.all(group.map(checkGame)));
  }

  const okCount = items.filter((item) => item.status === "ok").length;
  const warnCount = items.filter((item) => item.status === "warn").length;
  const failCount = items.filter((item) => item.status === "fail").length;
  return {
    ok: failCount === 0,
    generatedAt: new Date().toISOString(),
    checked: items.length,
    okCount,
    warnCount,
    failCount,
    payload: {
      feeds: payload.feeds.length,
      events: allEvents.length,
      liveFeeds: payload.feeds.filter((feed) => feed.sourceStatus === "live").length,
      staleFeeds: payload.feeds.filter((feed) => feed.sourceStatus === "stale").length,
      generatedAt: payload.generatedAt,
    },
    items,
  };
}
