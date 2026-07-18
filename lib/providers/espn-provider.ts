import {
  FOOTBALL_COMPETITIONS,
  SPORTS,
  getGameDetailsFromPath,
  getScoresFromEspnPath,
  repairMojibake,
  type GameDetails,
  type ScoreItem,
  type SportId,
} from "@/lib/live-data";
import {
  providerLive,
  providerUnavailable,
  type ProviderResult,
} from "@/lib/providers/provider-types";

const ESPN_STANDINGS_BASE = "https://site.api.espn.com/apis/v2/sports";

type AnyRecord = Record<string, unknown>;

export type EspnStandingValue = {
  key: string;
  label: string;
  value: string;
};

export type EspnStandingEntry = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string | null;
  logo: string | null;
  position: number | null;
  values: EspnStandingValue[];
};

export type EspnStandingGroup = {
  id: string;
  name: string;
  entries: EspnStandingEntry[];
};

const EXTRA_SPORT_PATHS: Partial<Record<SportId, string[]>> = {
  tenis: ["tennis/atp", "tennis/wta"],
  golfe: ["golf/pga"],
  mma: ["mma/ufc"],
  formula1: ["racing/f1"],
  "futebol-americano": ["football/nfl"],
  basquete: ["basketball/nba"],
  beisebol: ["baseball/mlb"],
};

const RELEVANT_STANDING_STATS = new Set([
  "rank", "playoffseed", "points", "championshippts", "gamesplayed", "wins", "losses", "ties",
  "pointdifferential", "pointsfor", "pointsagainst", "gamesbehind", "winpercent", "streak",
  "divisionrecord", "conferencerecord", "home", "road", "wildcard", "clincher",
]);

const STANDING_LABELS: Record<string, string> = {
  rank: "Pos.",
  playoffseed: "Pos.",
  points: "Pts",
  championshippts: "Pts",
  gamesplayed: "J",
  wins: "V",
  losses: "D",
  ties: "E",
  pointdifferential: "Saldo",
  pointsfor: "Pró",
  pointsagainst: "Contra",
  gamesbehind: "Atrás",
  winpercent: "%",
  streak: "Sequência",
  divisionrecord: "Divisão",
  conferencerecord: "Conferência",
  home: "Casa",
  road: "Fora",
  wildcard: "Wild card",
  clincher: "Vaga",
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

function asNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseFloat(asText(value));
  return Number.isFinite(parsed) ? parsed : null;
}

async function fetchJson(url: string, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "user-agent": "LAP Sports Center/1.0" },
    });
    if (!response.ok) throw new Error(`ESPN ${response.status}`);
    return await response.json() as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function unique<T>(items: T[]) {
  return [...new Set(items)];
}

export function getEspnPathsForSport(sportId: SportId, hintedPath?: string | null) {
  const configured = SPORTS.find((sport) => sport.id === sportId)?.espnPath;
  const paths = sportId === "futebol"
    ? FOOTBALL_COMPETITIONS.map((competition) => competition.espnPath)
    : EXTRA_SPORT_PATHS[sportId] ?? [];
  return unique([hintedPath, configured, ...paths].filter((path): path is string => Boolean(path)));
}

export async function loadEspnScores(
  sportId: SportId,
  path: string,
  options?: { daysBack?: number; daysAhead?: number; limit?: number; dates?: string | null },
): Promise<ProviderResult<ScoreItem[]>> {
  try {
    const scores = await getScoresFromEspnPath(sportId, path, options);
    return scores.length
      ? providerLive(scores)
      : providerUnavailable([], undefined, "Nenhum evento publicado para este período.");
  } catch (error) {
    return providerUnavailable([], error, "Agenda em atualização.");
  }
}

export async function loadEspnGameDetails(
  sportId: SportId,
  eventId: string,
  path: string,
  options?: { worldCup?: boolean },
): Promise<ProviderResult<GameDetails | null>> {
  try {
    const details = await getGameDetailsFromPath(sportId, eventId, path, options);
    return details
      ? providerLive(details, details.generatedAt)
      : providerUnavailable(null, undefined, "Os detalhes deste evento ainda não foram publicados.");
  } catch (error) {
    return providerUnavailable(null, error, "Os detalhes deste evento ainda não foram publicados.");
  }
}

function standingLogo(entity: AnyRecord) {
  const logos = asArray<AnyRecord>(entity.logos);
  const flag = asRecord(entity.flag);
  return asText(logos[0]?.href, asText(entity.logo, asText(flag.href))) || null;
}

function parseStandingEntry(raw: unknown, index: number): EspnStandingEntry | null {
  const entry = asRecord(raw);
  const entity = Object.keys(asRecord(entry.team)).length
    ? asRecord(entry.team)
    : Object.keys(asRecord(entry.athlete)).length
      ? asRecord(entry.athlete)
      : asRecord(entry.participant);
  const name = repairMojibake(asText(entity.displayName, asText(entity.name, asText(entity.shortName))));
  if (!name) return null;

  const values = asArray<AnyRecord>(entry.stats).flatMap((rawStat) => {
    const stat = asRecord(rawStat);
    const key = asText(stat.type, asText(stat.name)).toLowerCase().replace(/[^a-z]/g, "");
    if (!RELEVANT_STANDING_STATS.has(key)) return [];
    const value = repairMojibake(asText(stat.displayValue, asText(stat.value)));
    if (!value.trim()) return [];
    return [{
      key,
      label: STANDING_LABELS[key] ?? repairMojibake(asText(stat.shortDisplayName, asText(stat.abbreviation, key))),
      value,
    }];
  });
  const positionStat = asArray<AnyRecord>(entry.stats)
    .find((rawStat) => ["rank", "playoffseed"].includes(asText(asRecord(rawStat).type, asText(asRecord(rawStat).name)).toLowerCase().replace(/[^a-z]/g, "")));
  const position = asNumber(asRecord(positionStat).value) ?? asNumber(asRecord(positionStat).displayValue);

  return {
    id: asText(entity.id, `${name}-${index}`),
    name,
    shortName: repairMojibake(asText(entity.shortDisplayName, asText(entity.shortName, name))),
    abbreviation: repairMojibake(asText(entity.abbreviation)) || null,
    logo: standingLogo(entity),
    position,
    values,
  };
}

function collectStandingGroups(node: unknown, fallbackName: string, groups: EspnStandingGroup[] = []) {
  const record = asRecord(node);
  const standings = asRecord(record.standings);
  const entries = asArray(standings.entries)
    .map(parseStandingEntry)
    .filter((entry): entry is EspnStandingEntry => entry !== null)
    .sort((a, b) => (a.position ?? Number.MAX_SAFE_INTEGER) - (b.position ?? Number.MAX_SAFE_INTEGER));

  if (entries.length) {
    const name = repairMojibake(asText(record.name, asText(record.shortName, fallbackName)));
    groups.push({ id: asText(record.id, `${fallbackName}-${groups.length}`), name: name || fallbackName, entries });
  }

  for (const child of asArray(record.children)) collectStandingGroups(child, fallbackName, groups);
  return groups;
}

export async function loadEspnStandings(path: string, fallbackName: string): Promise<ProviderResult<EspnStandingGroup[]>> {
  const params = new URLSearchParams({
    region: "br",
    lang: "pt",
    contentorigin: "espn",
    isqualified: "true",
    type: "0",
    level: "2",
    sort: "rank:asc",
  });
  try {
    const json = await fetchJson(`${ESPN_STANDINGS_BASE}/${path}/standings?${params.toString()}`);
    const root = asRecord(json);
    const groups = collectStandingGroups(root, repairMojibake(asText(root.name, fallbackName)) || fallbackName);
    return groups.length
      ? providerLive(groups)
      : providerUnavailable([], undefined, "Classificação em atualização.");
  } catch (error) {
    return providerUnavailable([], error, "Classificação em atualização.");
  }
}

export async function findGameAcrossEspnPaths(
  sportId: SportId,
  eventId: string,
  paths: string[],
  options?: { worldCup?: boolean; batchSize?: number },
) {
  const batchSize = Math.max(1, Math.min(options?.batchSize ?? 5, 8));
  for (let index = 0; index < paths.length; index += batchSize) {
    const batch = paths.slice(index, index + batchSize);
    const results = await Promise.all(batch.map((path) => loadEspnGameDetails(sportId, eventId, path, options)));
    const found = results.find((result) => result.data)?.data;
    if (found) return found;
  }
  return null;
}

export async function findEventAcrossEspnSchedules(sportId: SportId, eventId: string, paths: string[]) {
  const current = await Promise.all(paths.map((path) => loadEspnScores(sportId, path, { dates: null, limit: 500 })));
  const currentMatch = current.flatMap((result) => result.data).find((event) => event.id === eventId);
  if (currentMatch) return currentMatch;
  const extended = await Promise.all(paths.map((path) => loadEspnScores(sportId, path, { daysBack: 120, daysAhead: 120, limit: 500 })));
  return extended.flatMap((result) => result.data).find((event) => event.id === eventId) ?? null;
}
