import { withScoreIntegrity } from "@/lib/score-integrity";
import type { LivePayload, NewsItem, ScoreItem, SportId } from "@/lib/live-data";

const SCORES_365_ENDPOINT = "https://webws.365scores.com/web/games/allscores";
const SUPPORTED_SPORTS = new Map<number, SportId>([
  [1, "futebol"],
  [2, "basquete"],
  [3, "tenis"],
  [6, "futebol-americano"],
  [7, "beisebol"],
  [8, "volei"],
  [9, "rugby"],
  [11, "criquete"],
]);
const DATE_OFFSETS = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
const WORLD_CUP_DATES_2026 = ["14/07/2026", "15/07/2026", "18/07/2026", "19/07/2026"];
const LAKERS_RECENT_DATES_2026 = ["11/07/2026", "12/07/2026", "15/07/2026", "16/07/2026", "19/07/2026"];
const REQUEST_TIMEOUT_MS = 7_500;

type JsonRecord = Record<string, unknown>;
type Scores365Payload = {
  games?: JsonRecord[];
  competitions?: JsonRecord[];
  countries?: JsonRecord[];
};

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

function numberValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function format365Date(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  return `${day}/${month}/${year}`;
}

function dateForOffset(offset: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return format365Date(date);
}

async function fetch365Date(date: string, sports?: number[]) {
  const url = new URL(SCORES_365_ENDPOINT);
  url.searchParams.set("appTypeId", "5");
  url.searchParams.set("langId", "1");
  url.searchParams.set("startDate", date);
  url.searchParams.set("endDate", date);
  if (sports?.length) url.searchParams.set("sports", sports.join(","));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "user-agent": "LAP Live Sports/6.0",
      },
    });
    if (!response.ok) throw new Error(`365Scores ${response.status}`);
    return await response.json() as Scores365Payload;
  } finally {
    clearTimeout(timer);
  }
}

function scoreValue(value: unknown) {
  const numeric = numberValue(value);
  if (numeric === null || numeric < 0) return null;
  return Number.isInteger(numeric) ? String(numeric) : String(numeric).replace(/\.0$/, "");
}

function eventState(game: JsonRecord): ScoreItem["state"] {
  const group = numberValue(game.statusGroup);
  const status = normalized(text(game.statusText, text(game.shortStatusText)));
  if (group === 3) return "in";
  if (group === 4 || /final|ended|after et|after penalties|retired|cancelled|postponed|abandoned|awarded/.test(status)) return "post";
  if (group === 2 || /scheduled|not started/.test(status)) return "pre";
  return "unknown";
}

function parse365Payload(payload: Scores365Payload) {
  const competitions = new Map((payload.competitions ?? []).map((item) => [text(item.id), item]));
  const countries = new Map((payload.countries ?? []).map((item) => [text(item.id), item]));

  return (payload.games ?? []).flatMap((game): ScoreItem[] => {
    const sportId = SUPPORTED_SPORTS.get(numberValue(game.sportId) ?? -1);
    if (!sportId) return [];

    const home = record(game.homeCompetitor);
    const away = record(game.awayCompetitor);
    const homeName = text(home.name, text(home.longName));
    const awayName = text(away.name, text(away.longName));
    if (!homeName || !awayName) return [];

    const competition = competitions.get(text(game.competitionId)) ?? {};
    const country = countries.get(text(competition.countryId)) ?? {};
    const status = text(game.shortStatusText, text(game.statusText, "Agenda confirmada"));
    const roundNumber = numberValue(game.roundNum);
    const roundName = text(game.roundName);

    const score: Omit<ScoreItem, "integrity" | "integrityReason"> = {
      id: `365-${text(game.id)}`,
      sportId,
      league: text(competition.shortName, text(competition.name, text(game.competitionDisplayName, "365Scores"))),
      round: roundName ? `${roundName}${roundNumber !== null ? ` ${roundNumber}` : ""}` : roundNumber !== null ? `Rodada ${roundNumber}` : null,
      venue: null,
      broadcast: null,
      status,
      state: eventState(game),
      startTime: text(game.startTime) || null,
      providerPath: null,
      competitionId: text(game.competitionId) || null,
      country: text(country.name) || null,
      eventKind: "match",
      home: { name: homeName, score: scoreValue(home.score) },
      away: { name: awayName, score: scoreValue(away.score) },
    };

    return [withScoreIntegrity(score)];
  });
}

function eventMinute(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString().slice(0, 16);
}

function eventKey(item: ScoreItem) {
  return normalized(`${item.sportId}|${item.home.name}|${item.away.name}|${eventMinute(item.startTime)}`);
}

function mergeScores(existing: ScoreItem[], incoming: ScoreItem[]) {
  const byKey = new Map<string, ScoreItem>();
  for (const item of incoming) byKey.set(eventKey(item), item);
  // ESPN fica por último quando ambos conhecem o mesmo jogo, preservando os detalhes/summary já existentes.
  for (const item of existing) byKey.set(eventKey(item), item);
  return [...byKey.values()].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return aTime - bTime;
  });
}

function isRemovedGame(item: ScoreItem) {
  const home = numberValue(item.home.score);
  const away = numberValue(item.away.score);
  return item.state === "post" && ((home === 28 && away === 3) || (home === 3 && away === 28));
}

function isInterview(item: NewsItem) {
  const haystack = normalized(`${item.slug} ${item.title} ${item.excerpt} ${item.source}`);
  return haystack.includes("entrevista") || haystack.includes("interview");
}

export function removeRetiredContent(payload: LivePayload): LivePayload {
  return {
    ...payload,
    editorial: payload.editorial.filter((item) => !isInterview(item)),
    feeds: payload.feeds.map((feed) => ({
      ...feed,
      news: feed.news.filter((item) => !isInterview(item)),
      scores: feed.scores.filter((item) => !isRemovedGame(item)),
    })),
    worldCup: {
      ...payload.worldCup,
      events: payload.worldCup.events.filter((item) => !isRemovedGame(item)),
    },
  };
}

function isWorldCupCompetition(item: ScoreItem) {
  const label = normalized(`${item.league} ${item.country ?? ""}`);
  return label.includes("world cup") || label.includes("world championship") || label.includes("copa do mundo") || label.includes("fifa world");
}

function isLakersGame(item: ScoreItem) {
  if (item.sportId !== "basquete") return false;
  const teams = normalized(`${item.home.name} ${item.away.name}`);
  return teams.includes("lakers") || teams.includes("los angeles lakers") || teams.includes("la lakers");
}

export async function apply365ScoresOverlay(payload: LivePayload): Promise<LivePayload> {
  const dates = DATE_OFFSETS.map(dateForOffset);
  const currentResults = await Promise.allSettled(dates.map((date) => fetch365Date(date)));
  const currentScores = currentResults.flatMap((result) => result.status === "fulfilled" ? parse365Payload(result.value) : []);

  // A NBA está fora de temporada em agosto de 2026. Incluímos os jogos mais recentes dos Lakers
  // para que o favorito não fique vazio enquanto a próxima agenda oficial ainda não estiver publicada.
  const lakersResults = new Date().getUTCFullYear() === 2026
    ? await Promise.allSettled(LAKERS_RECENT_DATES_2026.map((date) => fetch365Date(date, [2])))
    : [];
  const lakersRecent = lakersResults
    .flatMap((result) => result.status === "fulfilled" ? parse365Payload(result.value) : [])
    .filter(isLakersGame);

  const bySport = new Map<SportId, ScoreItem[]>();
  for (const score of [...currentScores, ...lakersRecent]) {
    bySport.set(score.sportId, [...(bySport.get(score.sportId) ?? []), score]);
  }

  let next: LivePayload = {
    ...payload,
    feeds: payload.feeds.map((feed) => {
      const extra = bySport.get(feed.id) ?? [];
      if (!extra.length) return feed;
      return {
        ...feed,
        scores: mergeScores(feed.scores, extra),
        sourceStatus: "live" as const,
        sourceNote: null,
      };
    }),
  };

  // A Copa de 2026 já terminou. Mantemos os últimos jogos do torneio acessíveis em vez de deixar o bloco vazio.
  if (next.worldCup.events.length === 0) {
    const cupResults = await Promise.allSettled(WORLD_CUP_DATES_2026.map((date) => fetch365Date(date, [1])));
    const cupScores = cupResults
      .flatMap((result) => result.status === "fulfilled" ? parse365Payload(result.value) : [])
      .filter(isWorldCupCompetition)
      .map((item) => ({ ...item, isWorldCup: true }));
    if (cupScores.length) {
      next = {
        ...next,
        worldCup: {
          ...next.worldCup,
          events: mergeScores(next.worldCup.events, cupScores),
          sourceStatus: "ok",
        },
      };
    }
  }

  return removeRetiredContent(next);
}
