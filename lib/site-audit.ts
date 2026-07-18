import { getCachedLivePayload } from "@/lib/free-live-data";
import { getResilientGameDetails } from "@/lib/resilient-game-details";
import { FOOTBALL_COMPETITIONS, SPORTS, type ScoreItem } from "@/lib/live-data";

export type SiteAuditStatus = "ok" | "warn" | "fail";

export type SiteAuditItem = {
  type: "route" | "modality" | "competition" | "game" | "api" | "article" | "content";
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

const TECHNICAL_COPY = [
  "feed sincronizado",
  "fonte em reconexão",
  "cache resiliente",
  "endpoint",
  "payload",
  "scoreboard",
  "fallback",
  "reconciliação",
  "recorte técnico",
  "arquitetura de dados",
  "fontes fortes candidatas",
  "dados necessários",
];

function eventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function eventPath(score: ScoreItem) {
  return `/jogos/${score.sportId}/${score.id}${score.isWorldCup ? "?torneio=copa-2026" : ""}`;
}

function eventApiPath(score: ScoreItem) {
  return `/api/games/${score.sportId}/${score.id}${score.isWorldCup ? "?torneio=copa-2026" : ""}`;
}

function scoreTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;
  const time = new Date(score.startTime).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function uniqueEvents(events: ScoreItem[]) {
  return Array.from(new Map(events.map((score) => [eventKey(score), score])).values());
}

function pickEventsForAudit(events: ScoreItem[], maxPerSport: number, deep: boolean) {
  const bySport = new Map<string, ScoreItem[]>();
  for (const event of events) bySport.set(event.sportId, [...(bySport.get(event.sportId) ?? []), event]);
  return [...bySport.values()].flatMap((items) => {
    const live = items.filter((event) => event.state === "in").sort((a, b) => scoreTime(a) - scoreTime(b));
    const upcoming = items.filter((event) => event.state === "pre").sort((a, b) => scoreTime(a) - scoreTime(b));
    const finished = items.filter((event) => event.state === "post").sort((a, b) => scoreTime(a) - scoreTime(b));
    const priority = [live[0], upcoming[0], finished[0], finished.at(-1)].filter((event): event is ScoreItem => Boolean(event));
    const remaining = [...live, ...upcoming, ...finished].filter((event) => !priority.some((selected) => eventKey(selected) === eventKey(event)));
    return uniqueEvents([...priority, ...remaining]).slice(0, deep ? Math.max(maxPerSport, 12) : Math.max(maxPerSport, 4));
  });
}

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) chunks.push(items.slice(index, index + size));
  return chunks;
}

async function fetchWithTimeout(url: string, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "user-agent": "LAP Site Audit/2.0" },
    });
  } finally {
    clearTimeout(timer);
  }
}

function plainText(html: string) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function contentChecks(path: string, type: SiteAuditItem["type"], html: string): SiteAuditItem[] {
  const text = plainText(html);
  const normalized = text.toLocaleLowerCase("pt-BR");
  const items: SiteAuditItem[] = [];
  const technical = TECHNICAL_COPY.find((term) => normalized.includes(term));
  if (technical) items.push({ type: "content", path, status: "fail", message: `Texto interno visível: “${technical}”.` });
  if (text.length < 280) items.push({ type: "content", path, status: "warn", message: "A página respondeu, mas tem pouco conteúdo útil para o visitante." });

  if (type === "modality") {
    const missing = [
      { label: "calendário", found: normalized.includes("calendário") || normalized.includes("agenda") },
      { label: "notícias", found: normalized.includes("notícias") || normalized.includes("histórias") },
      { label: "mapa da modalidade", found: normalized.includes("mapa da modalidade") || normalized.includes("competições") || normalized.includes("conferências") || normalized.includes("clubes") || normalized.includes("franquias") || normalized.includes("times") },
      { label: "guia", found: normalized.includes("como acompanhar") || normalized.includes("guia rápido") },
    ].filter((check) => !check.found).map((check) => check.label);
    items.push(missing.length
      ? { type: "content", path, status: "warn", message: `Faltam blocos essenciais: ${missing.join(", ")}.` }
      : { type: "content", path, status: "ok", message: "Calendário, notícias, mapa e guia encontrados." });
  }

  return items;
}

async function checkHttpPath(baseUrl: string, path: string, type: SiteAuditItem["type"] = "route"): Promise<SiteAuditItem[]> {
  try {
    const response = await fetchWithTimeout(`${baseUrl}${path}`);
    if (response.status === 404) return [{ type, path, status: "fail", httpStatus: response.status, message: "Página não encontrada (404)." }];
    if (response.status >= 400) return [{ type, path, status: "warn", httpStatus: response.status, message: `A página respondeu com HTTP ${response.status}.` }];
    const result: SiteAuditItem[] = [{ type, path, status: "ok", httpStatus: response.status, message: "Página respondeu normalmente." }];
    const contentType = response.headers.get("content-type") || "";
    if (type !== "api" && contentType.includes("text/html")) result.push(...contentChecks(path, type, await response.text()));
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Não foi possível verificar a página.";
    return [{ type, path, status: "warn", message: `Verificação incompleta: ${message}` }];
  }
}

async function checkGame(score: ScoreItem): Promise<SiteAuditItem> {
  const path = eventPath(score);
  const details = await getResilientGameDetails(score.sportId, score.id, { worldCup: Boolean(score.isWorldCup) }).catch(() => null);
  if (!details) return { type: "game", path, status: "fail", message: "O evento está na agenda, mas seus detalhes não abriram." };
  const hasSummaryOnly = !details.timeline.length && !details.teamStats.length && !details.lineups.length;
  if (hasSummaryOnly) return { type: "game", path, status: "warn", message: "A página abre com resumo e informações essenciais; estatísticas ainda não foram publicadas." };
  return { type: "game", path, status: "ok", message: "A página do evento abre com dados detalhados." };
}

function articlePaths(payload: Awaited<ReturnType<typeof getCachedLivePayload>>, deep: boolean) {
  const seen = new Set<string>();
  return [...payload.editorial, ...payload.feeds.flatMap((feed) => feed.news)]
    .map((item) => item.internalUrl)
    .filter((path) => {
      if (!path || seen.has(path)) return false;
      seen.add(path);
      return true;
    })
    .slice(0, deep ? 48 : 18);
}

export async function runSiteAudit(options?: { baseUrl?: string; maxPerSport?: number; deep?: boolean }): Promise<SiteAuditReport> {
  const baseUrl = (options?.baseUrl || process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app").replace(/\/$/, "");
  const maxPerSport = Math.min(Math.max(options?.maxPerSport ?? 4, 1), 20);
  const deep = Boolean(options?.deep);
  const payload = await getCachedLivePayload({ forceRefresh: true });
  const allEvents = uniqueEvents([...payload.worldCup.events, ...payload.feeds.flatMap((feed) => feed.scores)]);

  const corePaths = ["/", "/agenda", "/ao-vivo", "/copa-2026", "/cobertura", "/favoritos"];
  const modalityPaths = SPORTS.map((sport) => `/modalidades/${sport.id}`);
  const competitionPaths = FOOTBALL_COMPETITIONS.map((competition) => `/campeonatos/${competition.id}`);
  const items: SiteAuditItem[] = [];

  for (const paths of chunk(corePaths, 6)) {
    items.push(...(await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "route")))).flat());
  }
  for (const paths of chunk(modalityPaths, 4)) {
    items.push(...(await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "modality")))).flat());
  }
  for (const paths of chunk(competitionPaths, 6)) {
    items.push(...(await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "competition")))).flat());
  }

  for (const paths of chunk(["/api/live", "/api/health"], 2)) {
    items.push(...(await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "api")))).flat());
  }
  for (const paths of chunk(articlePaths(payload, deep), 6)) {
    items.push(...(await Promise.all(paths.map((path) => checkHttpPath(baseUrl, path, "article")))).flat());
  }

  const sampledEvents = pickEventsForAudit(allEvents, maxPerSport, deep);
  for (const group of chunk(sampledEvents, 4)) items.push(...await Promise.all(group.map(checkGame)));
  for (const group of chunk(sampledEvents, 4)) {
    items.push(...(await Promise.all(group.map((score) => checkHttpPath(baseUrl, eventPath(score), "game")))).flat());
    items.push(...(await Promise.all(group.map((score) => checkHttpPath(baseUrl, eventApiPath(score), "api")))).flat());
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
