import { getCachedLivePayload } from "@/lib/free-live-data";
import { type NewsItem, type ScoreItem } from "@/lib/live-data";
import { withScoreIntegrity } from "@/lib/score-integrity";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const NFL_PATH = "football/nfl";

type AnyRecord = Record<string, unknown>;

export type NflTeam = {
  name: string;
  city: string;
  abbr: string;
};

export type NflDivision = {
  conference: "AFC" | "NFC";
  division: string;
  teams: NflTeam[];
};

export type NflCenterDetails = {
  live: ScoreItem[];
  upcoming: ScoreItem[];
  recent: ScoreItem[];
  news: NewsItem[];
  divisions: NflDivision[];
  generatedAt: string;
};

export const NFL_DIVISIONS: NflDivision[] = [
  { conference: "AFC", division: "Leste", teams: [
    { city: "Buffalo", name: "Bills", abbr: "BUF" },
    { city: "Miami", name: "Dolphins", abbr: "MIA" },
    { city: "New England", name: "Patriots", abbr: "NE" },
    { city: "New York", name: "Jets", abbr: "NYJ" },
  ] },
  { conference: "AFC", division: "Norte", teams: [
    { city: "Baltimore", name: "Ravens", abbr: "BAL" },
    { city: "Cincinnati", name: "Bengals", abbr: "CIN" },
    { city: "Cleveland", name: "Browns", abbr: "CLE" },
    { city: "Pittsburgh", name: "Steelers", abbr: "PIT" },
  ] },
  { conference: "AFC", division: "Sul", teams: [
    { city: "Houston", name: "Texans", abbr: "HOU" },
    { city: "Indianapolis", name: "Colts", abbr: "IND" },
    { city: "Jacksonville", name: "Jaguars", abbr: "JAX" },
    { city: "Tennessee", name: "Titans", abbr: "TEN" },
  ] },
  { conference: "AFC", division: "Oeste", teams: [
    { city: "Denver", name: "Broncos", abbr: "DEN" },
    { city: "Kansas City", name: "Chiefs", abbr: "KC" },
    { city: "Las Vegas", name: "Raiders", abbr: "LV" },
    { city: "Los Angeles", name: "Chargers", abbr: "LAC" },
  ] },
  { conference: "NFC", division: "Leste", teams: [
    { city: "Dallas", name: "Cowboys", abbr: "DAL" },
    { city: "New York", name: "Giants", abbr: "NYG" },
    { city: "Philadelphia", name: "Eagles", abbr: "PHI" },
    { city: "Washington", name: "Commanders", abbr: "WAS" },
  ] },
  { conference: "NFC", division: "Norte", teams: [
    { city: "Chicago", name: "Bears", abbr: "CHI" },
    { city: "Detroit", name: "Lions", abbr: "DET" },
    { city: "Green Bay", name: "Packers", abbr: "GB" },
    { city: "Minnesota", name: "Vikings", abbr: "MIN" },
  ] },
  { conference: "NFC", division: "Sul", teams: [
    { city: "Atlanta", name: "Falcons", abbr: "ATL" },
    { city: "Carolina", name: "Panthers", abbr: "CAR" },
    { city: "New Orleans", name: "Saints", abbr: "NO" },
    { city: "Tampa Bay", name: "Buccaneers", abbr: "TB" },
  ] },
  { conference: "NFC", division: "Oeste", teams: [
    { city: "Arizona", name: "Cardinals", abbr: "ARI" },
    { city: "Los Angeles", name: "Rams", abbr: "LAR" },
    { city: "San Francisco", name: "49ers", abbr: "SF" },
    { city: "Seattle", name: "Seahawks", abbr: "SEA" },
  ] },
];

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

function formatDateRange(daysBack: number, daysAhead: number) {
  const start = new Date();
  const end = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  end.setUTCDate(end.getUTCDate() + daysAhead);
  const compact = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${compact(start)}-${compact(end)}`;
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

function parseBroadcast(competition: AnyRecord) {
  const broadcasts = asArray<AnyRecord>(competition.broadcasts);
  const names = broadcasts
    .map((broadcast) => asArray<AnyRecord>(broadcast.names).join(", ") || asText(asRecord(broadcast.media).shortName))
    .filter(Boolean);
  return names.length ? [...new Set(names)].join(", ") : null;
}

function parseTeam(competitor: AnyRecord) {
  const team = asRecord(competitor.team);
  const records = asArray<AnyRecord>(competitor.records);
  return {
    name: asText(team.displayName, asText(team.shortDisplayName, asText(team.name, "Equipe"))),
    score: asText(competitor.score) || null,
    logo: asText(team.logo) || null,
    record: records.map((record) => asText(record.summary)).find(Boolean) || null,
  };
}

function parseNflScoreboard(json: unknown) {
  return asArray<AnyRecord>(asRecord(json).events).flatMap((event) => {
    const competition = asArray<AnyRecord>(event.competitions)[0];
    if (!competition) return [];
    const competitors = asArray<AnyRecord>(competition.competitors);
    const homeRaw = competitors.find((item) => asText(item.homeAway) === "home") ?? competitors[0];
    const awayRaw = competitors.find((item) => asText(item.homeAway) === "away") ?? competitors[1];
    if (!homeRaw || !awayRaw) return [];

    const statusType = asRecord(asRecord(event.status).type);
    const rawState = asText(statusType.state);
    const state: ScoreItem["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
    const venue = asRecord(competition.venue);
    const season = asRecord(event.season);
    const seasonType = asRecord(season.type);
    const league = asRecord(event.league);

    const score: Omit<ScoreItem, "integrity" | "integrityReason"> = {
      id: asText(event.id),
      sportId: "futebol-americano",
      league: asText(league.name, "NFL"),
      round: asText(seasonType.name, asText(event.week ? `Semana ${asText(asRecord(event.week).number)}` : null)) || null,
      venue: asText(venue.fullName) || null,
      broadcast: parseBroadcast(competition),
      status: asText(statusType.shortDetail, asText(statusType.detail, "Agenda confirmada")),
      state,
      startTime: typeof event.date === "string" ? event.date : null,
      providerPath: NFL_PATH,
      competitionId: "nfl",
      country: "Estados Unidos",
      eventKind: "match",
      home: parseTeam(homeRaw),
      away: parseTeam(awayRaw),
    };

    return [withScoreIntegrity(score)];
  });
}

function eventTime(event: ScoreItem) {
  if (!event.startTime) return 0;
  const value = new Date(event.startTime).getTime();
  return Number.isFinite(value) ? value : 0;
}

function uniqueEvents(events: ScoreItem[]) {
  return Array.from(new Map(events.filter((event) => event.id).map((event) => [event.id, event])).values());
}

async function fetchNflSchedule() {
  const params = new URLSearchParams({ limit: "250", dates: formatDateRange(210, 260) });
  try {
    const response = await fetchWithTimeout(`${ESPN_BASE}/${NFL_PATH}/scoreboard?${params.toString()}`, {
      cache: "no-store",
      headers: { "user-agent": "LAP NFL Center/1.0" },
    });
    if (!response.ok) return [];
    return uniqueEvents(parseNflScoreboard(await response.json()));
  } catch {
    return [];
  }
}

export async function getNflCenterDetails(): Promise<NflCenterDetails> {
  const [directEvents, payload] = await Promise.all([
    fetchNflSchedule(),
    getCachedLivePayload().catch(() => null),
  ]);

  const fallbackFeed = payload?.feeds.find((feed) => feed.id === "futebol-americano");
  const events = directEvents.length ? directEvents : fallbackFeed?.scores ?? [];
  const live = events.filter((event) => event.state === "in");
  const upcoming = events.filter((event) => event.state === "pre").sort((a, b) => eventTime(a) - eventTime(b));
  const recent = events.filter((event) => event.state === "post").sort((a, b) => eventTime(b) - eventTime(a));
  const news = [...(payload?.editorial ?? []), ...(fallbackFeed?.news ?? [])]
    .filter((item) => {
      const haystack = `${item.title} ${item.excerpt} ${item.source}`.toLowerCase();
      return item.sportId === "futebol-americano" || haystack.includes("nfl") || haystack.includes("super bowl") || haystack.includes("futebol americano");
    })
    .slice(0, 8);

  return {
    live,
    upcoming,
    recent,
    news,
    divisions: NFL_DIVISIONS,
    generatedAt: new Date().toISOString(),
  };
}
