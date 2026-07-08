import { getCachedLivePayload } from "@/lib/free-live-data";
import { getSportDataBlueprint } from "@/lib/sport-data-blueprints";
import { FOOTBALL_COMPETITIONS, getGameDetails, SPORTS, type GameDetails, type ScoreItem, type SportId } from "@/lib/live-data";
import { withScoreIntegrity } from "@/lib/score-integrity";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? value as AnyRecord : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function sameEvent(score: ScoreItem, sportId: SportId, eventId: string, worldCup = false) {
  return score.sportId === sportId && score.id === eventId && (!worldCup || Boolean(score.isWorldCup));
}

function eventTitle(event: ScoreItem) {
  return event.eventKind === "race" ? event.home.name : `${event.home.name} x ${event.away.name}`;
}

function fallbackNotes(event: ScoreItem) {
  const sport = SPORTS.find((item) => item.id === event.sportId);
  const blueprint = getSportDataBlueprint(event.sportId);
  return [
    event.venue ? `Local: ${event.venue}` : null,
    event.broadcast ? `Transmissão: ${event.broadcast}` : null,
    blueprint ? `Formato da modalidade: ${blueprint.primarySurface}` : sport?.description || null,
    "Mais detalhes aparecem aqui quando estiverem disponíveis.",
  ].filter((item): item is string => Boolean(item));
}

async function findCachedEvent(sportId: SportId, eventId: string, worldCup = false) {
  const payload = await getCachedLivePayload().catch(() => null);
  if (!payload) return null;
  const events = [
    ...payload.worldCup.events,
    ...payload.feeds.flatMap((feed) => feed.scores),
  ];
  return events.find((score) => sameEvent(score, sportId, eventId, worldCup)) ?? null;
}

function detailsFromScore(event: ScoreItem, headlines?: string[], notes?: string[]): GameDetails {
  return {
    event,
    timeline: [],
    teamStats: [],
    lineups: [],
    headlines: headlines?.length ? headlines : [
      `${eventTitle(event)} está na agenda da LAP.`,
      event.status ? `Status: ${event.status}.` : "Evento acompanhado pela LAP.",
    ],
    notes: notes?.length ? notes : fallbackNotes(event),
    sourceStatus: "ok",
    generatedAt: new Date().toISOString(),
  };
}

function parseTeam(competitor: AnyRecord) {
  const team = asRecord(competitor.team);
  const records = asArray<AnyRecord>(competitor.records);
  return {
    name: asText(team.displayName, asText(team.shortDisplayName, asText(team.name, "Time"))),
    score: asText(competitor.score) || null,
    logo: asText(team.logo) || null,
    record: records.map((record) => asText(record.summary)).find(Boolean) || null,
  };
}

function parseFootballHeaderEvent(json: unknown, competitionId: string): ScoreItem | null {
  const competitionInfo = FOOTBALL_COMPETITIONS.find((item) => item.id === competitionId);
  if (!competitionInfo) return null;
  const header = asRecord(asRecord(json).header);
  const competitions = asArray<AnyRecord>(header.competitions);
  const competition = competitions[0];
  if (!competition) return null;
  const competitors = asArray<AnyRecord>(competition.competitors);
  const homeRaw = competitors.find((item) => asText(item.homeAway) === "home") ?? competitors[0];
  const awayRaw = competitors.find((item) => asText(item.homeAway) === "away") ?? competitors[1];
  if (!homeRaw || !awayRaw) return null;
  const statusType = asRecord(asRecord(header.status).type);
  const rawState = asText(statusType.state);
  const state: ScoreItem["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
  const venue = asRecord(competition.venue);
  const score: Omit<ScoreItem, "integrity" | "integrityReason"> = {
    id: asText(header.id),
    sportId: "futebol",
    league: competitionInfo.name,
    round: asText(header.seasonType, asText(header.name)) || null,
    venue: asText(venue.fullName) || null,
    broadcast: null,
    status: asText(statusType.shortDetail, asText(statusType.detail, "Agenda confirmada")),
    state,
    startTime: typeof header.date === "string" ? header.date : null,
    providerPath: competitionInfo.espnPath,
    competitionId: competitionInfo.id,
    country: competitionInfo.country,
    eventKind: "match",
    home: parseTeam(homeRaw),
    away: parseTeam(awayRaw),
  };
  return withScoreIntegrity(score);
}

async function findFootballEventThroughLeaguePaths(eventId: string) {
  for (const competition of FOOTBALL_COMPETITIONS) {
    try {
      const response = await fetchWithTimeout(`${ESPN_BASE}/${competition.espnPath}/summary?event=${encodeURIComponent(eventId)}`, {
        cache: "no-store",
        headers: { "user-agent": "LAP Sports Dashboard/5.1" },
      });
      if (!response.ok) continue;
      const json = await response.json();
      const event = parseFootballHeaderEvent(json, competition.id);
      if (event) return detailsFromScore(event);
    } catch {
      // Tenta a próxima competição mapeada.
    }
  }
  return null;
}

export async function getResilientGameDetails(sportId: SportId, eventId: string, options?: { worldCup?: boolean }): Promise<GameDetails | null> {
  const direct = await getGameDetails(sportId, eventId, options).catch(() => null);
  if (direct) return direct;

  const cached = await findCachedEvent(sportId, eventId, Boolean(options?.worldCup));
  if (cached) return detailsFromScore(cached);

  if (sportId === "futebol" && !options?.worldCup) {
    return findFootballEventThroughLeaguePaths(eventId);
  }

  return null;
}
