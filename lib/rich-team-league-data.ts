import { getCachedLivePayload } from "@/lib/free-live-data";
import { loadEspnStandings, type EspnStandingGroup } from "@/lib/providers/espn-provider";
import type { NewsItem, ScoreItem, SportId } from "@/lib/live-data";

export type ProLeagueId = "nfl" | "nba" | "mlb";

type LeagueConfig = {
  id: ProLeagueId;
  sportId: SportId;
  label: string;
  title: string;
  subtitle: string;
  espnPath: string;
  coreSport: string;
  coreLeague: string;
  salaryUrl: string;
  salaryLabel: string;
};

export type ProTeam = {
  id: string;
  name: string;
  shortName: string;
  abbreviation: string;
  location: string;
  logo: string | null;
  color: string | null;
  alternateColor: string | null;
};

export type ProPlayer = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  age: number | null;
  experience: string | null;
  height: string | null;
  weight: string | null;
  college: string | null;
  birthplace: string | null;
  headshot: string | null;
  salary: string | null;
};

export type ProVenue = {
  name: string | null;
  city: string | null;
  state: string | null;
  capacity: number | null;
  indoor: boolean | null;
  grass: boolean | null;
};

export type ProTeamGame = {
  id: string;
  date: string | null;
  status: string;
  state: "pre" | "in" | "post" | "unknown";
  opponent: string;
  opponentLogo: string | null;
  homeAway: "home" | "away" | "neutral" | null;
  teamScore: string | null;
  opponentScore: string | null;
  venue: string | null;
};

export type ProTeamDetail = {
  league: ProLeagueId;
  team: ProTeam;
  record: string | null;
  standing: string | null;
  venue: ProVenue;
  roster: ProPlayer[];
  schedule: ProTeamGame[];
  knownPayroll: number;
  salaryCoverage: number;
  salaryLabel: string;
  generatedAt: string;
};

export type ProLeagueHub = {
  config: LeagueConfig;
  teams: ProTeam[];
  standings: EspnStandingGroup[];
  live: ScoreItem[];
  upcoming: ScoreItem[];
  recent: ScoreItem[];
  news: NewsItem[];
  generatedAt: string;
};

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports";

export const PRO_LEAGUES: Record<ProLeagueId, LeagueConfig> = {
  nfl: {
    id: "nfl",
    sportId: "futebol-americano",
    label: "NFL",
    title: "NFL na LAP",
    subtitle: "32 franquias, elencos, estádios, calendário, classificação e notícias em uma central completa.",
    espnPath: "football/nfl",
    coreSport: "football",
    coreLeague: "nfl",
    salaryUrl: "https://www.espn.com/nfl/salaries",
    salaryLabel: "Salário publicado",
  },
  nba: {
    id: "nba",
    sportId: "basquete",
    label: "NBA",
    title: "NBA na LAP",
    subtitle: "As 30 franquias da NBA com elenco, arena, calendário, classificação, salários disponíveis e notícias.",
    espnPath: "basketball/nba",
    coreSport: "basketball",
    coreLeague: "nba",
    salaryUrl: "https://www.espn.com/nba/salaries",
    salaryLabel: "Salário da temporada",
  },
  mlb: {
    id: "mlb",
    sportId: "beisebol",
    label: "MLB",
    title: "MLB na LAP",
    subtitle: "As franquias da Major League Baseball com roster, estádio, agenda, classificação e contexto da temporada.",
    espnPath: "baseball/mlb",
    coreSport: "baseball",
    coreLeague: "mlb",
    salaryUrl: "https://www.espn.com/mlb/salaries",
    salaryLabel: "Salário publicado",
  },
};

type AnyRecord = Record<string, unknown>;

function rec(value: unknown): AnyRecord { return value && typeof value === "object" ? value as AnyRecord : {}; }
function arr<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function txt(value: unknown, fallback = "") { return typeof value === "string" || typeof value === "number" ? String(value) : fallback; }
function nullable(value: unknown) { const valueText = txt(value).trim(); return valueText || null; }

function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv)\.?\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function safeJson(url: string, revalidate = 900): Promise<unknown | null> {
  try {
    const response = await fetch(url, { next: { revalidate }, headers: { "user-agent": "LAP Live Sports/6.0" } });
    if (!response.ok) return null;
    return await response.json();
  } catch { return null; }
}

async function safeText(url: string, revalidate = 6 * 60 * 60): Promise<string | null> {
  try {
    const response = await fetch(url, { next: { revalidate }, headers: { "user-agent": "Mozilla/5.0 LAP Live Sports" } });
    if (!response.ok) return null;
    return await response.text();
  } catch { return null; }
}

function parseTeam(value: unknown): ProTeam | null {
  const wrapper = rec(value);
  const team = Object.keys(rec(wrapper.team)).length ? rec(wrapper.team) : wrapper;
  const id = txt(team.id);
  const name = txt(team.displayName, txt(team.name));
  if (!id || !name) return null;
  const logos = arr<AnyRecord>(team.logos);
  return {
    id,
    name,
    shortName: txt(team.shortDisplayName, name),
    abbreviation: txt(team.abbreviation),
    location: txt(team.location, name),
    logo: nullable(team.logo) || logos.map((item) => nullable(item.href)).find(Boolean) || null,
    color: nullable(team.color),
    alternateColor: nullable(team.alternateColor),
  };
}

async function loadTeams(config: LeagueConfig) {
  const json = await safeJson(`${ESPN_SITE}/${config.espnPath}/teams?limit=100`, 6 * 60 * 60);
  const sports = arr<AnyRecord>(rec(json).sports);
  const leagues = arr<AnyRecord>(sports[0]?.leagues);
  return arr(leagues[0]?.teams).map(parseTeam).filter((item): item is ProTeam => Boolean(item));
}

function eventTime(item: ScoreItem) {
  if (!item.startTime) return 0;
  const time = new Date(item.startTime).getTime();
  return Number.isFinite(time) ? time : 0;
}

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values())
    .sort((a, b) => (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0))
    .slice(0, 12);
}

export async function getProLeagueHub(league: ProLeagueId): Promise<ProLeagueHub> {
  const config = PRO_LEAGUES[league];
  const [teams, standingsResult, payload] = await Promise.all([
    loadTeams(config),
    loadEspnStandings(config.espnPath, config.label),
    getCachedLivePayload().catch(() => null),
  ]);
  const feed = payload?.feeds.find((item) => item.id === config.sportId);
  const scores = feed?.scores ?? [];
  const live = scores.filter((item) => item.state === "in");
  const upcoming = scores.filter((item) => item.state === "pre").sort((a, b) => eventTime(a) - eventTime(b));
  const recent = scores.filter((item) => item.state === "post").sort((a, b) => eventTime(b) - eventTime(a));
  const news = uniqueNews([...(payload?.editorial ?? []).filter((item) => item.sportId === config.sportId), ...(feed?.news ?? [])]);
  return { config, teams, standings: standingsResult.data, live, upcoming, recent, news, generatedAt: new Date().toISOString() };
}

function parseSalaryNumber(value: string) {
  const digits = value.replace(/[^0-9.]/g, "");
  const number = Number(digits);
  return Number.isFinite(number) ? number : 0;
}

async function loadSalaryMap(config: LeagueConfig) {
  const html = await safeText(config.salaryUrl);
  const map = new Map<string, string>();
  if (!html) return map;
  const rows = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(stripHtml);
    const salary = cells.find((cell) => /\$\s?[0-9][0-9,]*(?:\.[0-9]+)?/.test(cell));
    if (!salary) continue;
    const nameCell = cells.find((cell) => cell !== salary && /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]/.test(cell) && !/^\d+$/.test(cell));
    if (!nameCell) continue;
    const cleanedName = nameCell.replace(/\s*,\s*(QB|RB|WR|TE|OT|G|C|DE|DT|LB|CB|S|P|K|LS|G|F|C|PG|SG|SF|PF|P|SP|RP|1B|2B|3B|SS|LF|CF|RF|DH)\b.*$/i, "").trim();
    map.set(normalizeName(cleanedName), salary.replace(/\s+/g, ""));
  }
  return map;
}

function birthplace(athlete: AnyRecord) {
  const place = rec(athlete.birthPlace);
  return [nullable(place.city), nullable(place.state), nullable(place.country)].filter(Boolean).join(", ") || null;
}

function college(athlete: AnyRecord) {
  const value = rec(athlete.college);
  return nullable(value.name) || null;
}

function parseRoster(json: unknown, salaries: Map<string, string>): ProPlayer[] {
  const groups = arr<AnyRecord>(rec(json).athletes);
  const athletes = groups.flatMap((group) => {
    const items = arr(group.items);
    return items.length ? items : [group];
  });
  return athletes.flatMap((value) => {
    const athlete = rec(value);
    const id = txt(athlete.id);
    const name = txt(athlete.fullName, txt(athlete.displayName));
    if (!id || !name) return [];
    const position = rec(athlete.position);
    const experience = rec(athlete.experience);
    const headshot = rec(athlete.headshot);
    const age = typeof athlete.age === "number" ? athlete.age : Number.isFinite(Number(athlete.age)) ? Number(athlete.age) : null;
    return [{
      id,
      name,
      jersey: nullable(athlete.jersey),
      position: nullable(position.abbreviation) || nullable(position.displayName),
      age,
      experience: nullable(experience.displayValue) || nullable(athlete.experienceYears),
      height: nullable(athlete.displayHeight),
      weight: nullable(athlete.displayWeight),
      college: college(athlete),
      birthplace: birthplace(athlete),
      headshot: nullable(headshot.href),
      salary: salaries.get(normalizeName(name)) ?? null,
    } satisfies ProPlayer];
  }).sort((a, b) => (a.position || "ZZ").localeCompare(b.position || "ZZ") || a.name.localeCompare(b.name));
}

function parseSchedule(json: unknown, teamId: string): ProTeamGame[] {
  return arr<AnyRecord>(rec(json).events).flatMap((event) => {
    const competition = arr<AnyRecord>(event.competitions)[0];
    if (!competition) return [];
    const competitors = arr<AnyRecord>(competition.competitors);
    const own = competitors.find((item) => txt(rec(item.team).id) === teamId);
    const opponent = competitors.find((item) => txt(rec(item.team).id) !== teamId);
    if (!own || !opponent) return [];
    const opponentTeam = rec(opponent.team);
    const opponentLogos = arr<AnyRecord>(opponentTeam.logos);
    const statusType = rec(rec(event.status).type);
    const rawState = txt(statusType.state);
    const state: ProTeamGame["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
    const homeAwayRaw = txt(own.homeAway);
    const homeAway: ProTeamGame["homeAway"] = competition.neutralSite === true ? "neutral" : homeAwayRaw === "home" || homeAwayRaw === "away" ? homeAwayRaw : null;
    const venue = rec(competition.venue);
    return [{
      id: txt(event.id),
      date: nullable(event.date),
      status: txt(statusType.shortDetail, txt(statusType.detail, "Agendado")),
      state,
      opponent: txt(opponentTeam.displayName, txt(opponentTeam.shortDisplayName, "Adversário")),
      opponentLogo: nullable(opponentTeam.logo) || opponentLogos.map((logo) => nullable(logo.href)).find(Boolean) || null,
      homeAway,
      teamScore: own.score === undefined || own.score === null || own.score === "" ? null : String(own.score),
      opponentScore: opponent.score === undefined || opponent.score === null || opponent.score === "" ? null : String(opponent.score),
      venue: nullable(venue.fullName),
    } satisfies ProTeamGame];
  });
}

async function loadVenue(config: LeagueConfig, teamId: string): Promise<ProVenue> {
  const fallback: ProVenue = { name: null, city: null, state: null, capacity: null, indoor: null, grass: null };
  const year = new Date().getUTCFullYear();
  const season = config.id === "nba" && new Date().getUTCMonth() >= 6 ? year + 1 : year;
  const core = await safeJson(`${ESPN_CORE}/${config.coreSport}/leagues/${config.coreLeague}/seasons/${season}/types/2/teams/${teamId}?lang=en&region=us`, 24 * 60 * 60);
  if (!core) return fallback;
  const teamRecord = rec(core);
  const venueRef = rec(teamRecord.venue);
  const refUrl = nullable(venueRef.$ref);
  const venueData = refUrl ? await safeJson(refUrl, 24 * 60 * 60) : venueRef;
  const venue = rec(venueData);
  const address = rec(venue.address);
  return {
    name: nullable(venue.fullName),
    city: nullable(address.city),
    state: nullable(address.state),
    capacity: typeof venue.capacity === "number" ? venue.capacity : Number.isFinite(Number(venue.capacity)) ? Number(venue.capacity) : null,
    indoor: typeof venue.indoor === "boolean" ? venue.indoor : null,
    grass: typeof venue.grass === "boolean" ? venue.grass : null,
  };
}

export async function getProTeamDetail(league: ProLeagueId, teamId: string): Promise<ProTeamDetail | null> {
  const config = PRO_LEAGUES[league];
  const currentYear = new Date().getUTCFullYear();
  const season = league === "nba" && new Date().getUTCMonth() >= 6 ? currentYear + 1 : currentYear;
  const [teamJson, rosterJson, scheduleJson, venue, salaryMap] = await Promise.all([
    safeJson(`${ESPN_SITE}/${config.espnPath}/teams/${teamId}`, 6 * 60 * 60),
    safeJson(`${ESPN_SITE}/${config.espnPath}/teams/${teamId}/roster`, 6 * 60 * 60),
    safeJson(`${ESPN_SITE}/${config.espnPath}/teams/${teamId}/schedule?season=${season}`, 30 * 60),
    loadVenue(config, teamId),
    loadSalaryMap(config),
  ]);
  if (!teamJson) return null;
  const root = rec(teamJson);
  const teamRaw = rec(root.team);
  const team = parseTeam(Object.keys(teamRaw).length ? teamRaw : root);
  if (!team) return null;
  const roster = rosterJson ? parseRoster(rosterJson, salaryMap) : [];
  const schedule = scheduleJson ? parseSchedule(scheduleJson, teamId) : [];
  const knownPayroll = roster.reduce((sum, player) => sum + (player.salary ? parseSalaryNumber(player.salary) : 0), 0);
  const salaryCoverage = roster.filter((player) => player.salary).length;
  return {
    league,
    team,
    record: nullable(teamRaw.record) || nullable(root.record),
    standing: nullable(teamRaw.standingSummary) || nullable(root.standingSummary),
    venue,
    roster,
    schedule,
    knownPayroll,
    salaryCoverage,
    salaryLabel: config.salaryLabel,
    generatedAt: new Date().toISOString(),
  };
}
