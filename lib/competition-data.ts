import { getCachedLivePayload } from "@/lib/free-live-data";
import {
  FOOTBALL_COMPETITIONS,
  type CompetitionDetails,
  type CompetitionLeader,
  type CompetitionTableRow,
  type FootballCompetition,
  type NewsItem,
  type ScoreItem,
} from "@/lib/live-data";
import { canDisplayScore, withScoreIntegrity } from "@/lib/score-integrity";

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

type AnyRecord = Record<string, unknown>;

type DirectCompetitionResult = {
  scores: ScoreItem[];
  sourceStatus: CompetitionDetails["sourceStatus"];
  sourceNote: string | null;
};

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

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
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

function eventTime(score: ScoreItem) {
  if (!score.startTime) return 0;
  const value = new Date(score.startTime).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortEvents(items: ScoreItem[]) {
  return [...items].sort((a, b) => eventTime(a) - eventTime(b));
}

function uniqueScores(items: ScoreItem[]) {
  return Array.from(new Map(items.filter((item) => item.id).map((item) => [`${item.sportId}:${item.id}:${item.competitionId ?? "league"}`, item])).values());
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
    name: asText(team.displayName, asText(team.shortDisplayName, asText(team.name, "Time"))),
    score: asText(competitor.score) || null,
    logo: asText(team.logo) || null,
    record: records.map((record) => asText(record.summary)).find(Boolean) || null,
  };
}

function parseScoreboard(json: unknown, competitionInfo: FootballCompetition) {
  const events = asArray<AnyRecord>(asRecord(json).events);
  return events.flatMap((event) => {
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
    const score: Omit<ScoreItem, "integrity" | "integrityReason"> = {
      id: asText(event.id),
      sportId: "futebol",
      league: competitionInfo.name,
      round: asText(seasonType.name, asText(event.name)) || null,
      venue: asText(venue.fullName) || null,
      broadcast: parseBroadcast(competition),
      status: asText(statusType.shortDetail, asText(statusType.detail, "Agenda confirmada")),
      state,
      startTime: typeof event.date === "string" ? event.date : null,
      providerPath: competitionInfo.espnPath,
      competitionId: competitionInfo.id,
      country: competitionInfo.country,
      eventKind: "match",
      home: parseTeam(homeRaw),
      away: parseTeam(awayRaw),
    };
    return [withScoreIntegrity(score)];
  });
}

function scoreMatchesCompetition(score: ScoreItem, competition: FootballCompetition) {
  if (score.competitionId === competition.id) return true;
  const haystack = normalizedText(`${score.league} ${score.round || ""} ${score.country || ""}`);
  return [competition.name, competition.country, competition.espnPath.split("/").pop() || ""]
    .map(normalizedText)
    .some((term) => term.length > 3 && haystack.includes(term));
}

async function loadDirectCompetitionScores(competition: FootballCompetition): Promise<DirectCompetitionResult> {
  const params = new URLSearchParams({ limit: "200", dates: formatDateRange(95, 45) });
  try {
    const response = await fetchWithTimeout(`${ESPN_BASE}/${competition.espnPath}/scoreboard?${params.toString()}`, {
      cache: "no-store",
      headers: { "user-agent": "LAP Competition Center/1.0" },
    });
    if (!response.ok) throw new Error(`Scoreboard ${response.status}`);
    const scores = sortEvents(uniqueScores(parseScoreboard(await response.json(), competition)));
    return { scores, sourceStatus: "live", sourceNote: null };
  } catch {
    return { scores: [], sourceStatus: "unavailable", sourceNote: "Não conseguimos atualizar esta competição agora." };
  }
}

function numericScore(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureTableRow(rows: Map<string, CompetitionTableRow>, team: ScoreItem["home"]) {
  const key = team.name;
  if (!rows.has(key)) {
    rows.set(key, {
      team: team.name,
      logo: team.logo || null,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      form: [],
    });
  }
  return rows.get(key)!;
}

function buildCompetitionTable(events: ScoreItem[]) {
  const rows = new Map<string, CompetitionTableRow>();
  for (const score of events) {
    ensureTableRow(rows, score.home);
    ensureTableRow(rows, score.away);
    if (score.state !== "post") continue;
    if (!canDisplayScore(score)) continue;
    const homeScore = numericScore(score.home.score);
    const awayScore = numericScore(score.away.score);
    if (homeScore === null || awayScore === null) continue;
    const home = ensureTableRow(rows, score.home);
    const away = ensureTableRow(rows, score.away);
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    if (homeScore === awayScore) {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
      home.form.unshift("E");
      away.form.unshift("E");
    } else if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
      home.form.unshift("V");
      away.form.unshift("D");
    } else {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
      away.form.unshift("V");
      home.form.unshift("D");
    }
    home.form = home.form.slice(0, 5);
    away.form = away.form.slice(0, 5);
  }
  return [...rows.values()]
    .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .slice(0, 20);
}

function buildCompetitionLeaders(events: ScoreItem[]): CompetitionLeader[] {
  const table = buildCompetitionTable(events).filter((row) => row.played > 0);
  const byGoals = [...table].sort((a, b) => b.goalsFor - a.goalsFor);
  const byDefense = [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst);
  const byForm = [...table].sort((a, b) => b.points - a.points);
  return [
    byGoals[0] ? { label: "Melhor ataque", team: byGoals[0].team, value: `${byGoals[0].goalsFor} gols` } : null,
    byDefense[0] ? { label: "Melhor defesa", team: byDefense[0].team, value: `${byDefense[0].goalsAgainst} sofridos` } : null,
    byForm[0] ? { label: "Maior pontuação", team: byForm[0].team, value: `${byForm[0].points} pts` } : null,
  ].filter((item): item is CompetitionLeader => item !== null);
}

function competitionNews(news: NewsItem[], competition: FootballCompetition) {
  const terms = normalizedText(`${competition.name} ${competition.country} brasileirão brasileirao serie série`).split(" ").filter((term) => term.length > 4);
  return news
    .filter((item) => {
      const text = normalizedText(`${item.title} ${item.excerpt} ${item.source}`);
      return terms.some((term) => text.includes(term));
    })
    .slice(0, 6);
}

export async function getCompetitionCenterDetails(competitionId: string): Promise<CompetitionDetails | null> {
  const competition = FOOTBALL_COMPETITIONS.find((item) => item.id === competitionId);
  if (!competition) return null;

  const [direct, payload] = await Promise.all([
    loadDirectCompetitionScores(competition),
    getCachedLivePayload().catch(() => null),
  ]);

  const footballFeed = payload?.feeds.find((feed) => feed.id === "futebol");
  const fallbackScores = (footballFeed?.scores ?? []).filter((score) => scoreMatchesCompetition(score, competition));
  const scores = direct.scores.length ? direct.scores : sortEvents(uniqueScores(fallbackScores));
  const live = scores.filter((score) => score.state === "in");
  const upcoming = scores.filter((score) => score.state === "pre").sort((a, b) => eventTime(a) - eventTime(b));
  const recent = scores.filter((score) => score.state === "post").sort((a, b) => eventTime(b) - eventTime(a));
  const news = competitionNews([...(payload?.editorial ?? []), ...(footballFeed?.news ?? [])], competition);

  return {
    competition,
    live,
    upcoming,
    recent,
    table: buildCompetitionTable(scores),
    leaders: buildCompetitionLeaders(scores),
    news,
    sourceStatus: direct.scores.length ? "live" : footballFeed?.sourceStatus ?? direct.sourceStatus,
    sourceNote: direct.scores.length ? null : direct.sourceNote,
    generatedAt: new Date().toISOString(),
  };
}
