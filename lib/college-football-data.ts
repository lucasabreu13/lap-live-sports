export type CollegeDivision = "fbs" | "fcs" | "d2" | "d3";

export type CollegeTeam = {
  id: string;
  name: string;
  shortName: string;
  location: string;
  nickname: string;
  abbreviation: string;
  logo: string | null;
  conference: string | null;
  color: string | null;
  alternateColor: string | null;
  division: CollegeDivision;
};

export type CollegeGame = {
  id: string;
  date: string | null;
  status: string;
  state: "pre" | "in" | "post" | "unknown";
  venue: string | null;
  broadcast: string | null;
  home: { id: string | null; name: string; logo: string | null; score: string | null; record: string | null };
  away: { id: string | null; name: string; logo: string | null; score: string | null; record: string | null };
};

export type ChampionshipRow = {
  season: string;
  champion: string;
  coach: string | null;
  score: string | null;
  runnerUp: string | null;
  site: string | null;
  selector: string | null;
};

export type CollegeDivisionSnapshot = {
  division: CollegeDivision;
  label: string;
  teams: CollegeTeam[];
  games: CollegeGame[];
  championshipHistory: ChampionshipRow[];
  generatedAt: string;
  sourceStatus: "ok" | "partial" | "unavailable";
};

export type CollegeFootballHub = {
  season: number;
  generatedAt: string;
  divisions: Record<CollegeDivision, CollegeDivisionSnapshot>;
};

export type CollegePlayer = {
  id: string;
  name: string;
  jersey: string | null;
  position: string | null;
  classYear: string | null;
  height: string | null;
  weight: string | null;
  hometown: string | null;
  headshot: string | null;
};

export type CollegeVenue = {
  name: string | null;
  city: string | null;
  state: string | null;
  capacity: number | null;
  indoor: boolean | null;
  grass: boolean | null;
};

export type CollegeTeamScheduleItem = {
  id: string;
  date: string | null;
  status: string;
  state: "pre" | "in" | "post" | "unknown";
  homeAway: "home" | "away" | "neutral" | null;
  opponent: string;
  opponentLogo: string | null;
  teamScore: string | null;
  opponentScore: string | null;
  venue: string | null;
};

export type CollegeTeamDetail = {
  team: CollegeTeam;
  venue: CollegeVenue;
  roster: CollegePlayer[];
  schedule: CollegeTeamScheduleItem[];
  titles: ChampionshipRow[];
  titleCount: number;
  record: string | null;
  sourceStatus: "ok" | "partial" | "unavailable";
  generatedAt: string;
};

const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports/football/college-football";
const ESPN_CORE = "https://sports.core.api.espn.com/v2/sports/football/leagues/college-football";
const NCAA_API = "https://ncaa-api.henrygd.me";

export const COLLEGE_DIVISIONS: Record<CollegeDivision, { label: string; espnGroup: string; ncaaPath: string }> = {
  fbs: { label: "FBS", espnGroup: "80", ncaaPath: "fbs" },
  fcs: { label: "FCS", espnGroup: "81", ncaaPath: "fcs" },
  d2: { label: "Division II", espnGroup: "57", ncaaPath: "d2" },
  d3: { label: "Division III", espnGroup: "58", ncaaPath: "d3" },
};

const CURRENT_SEASON = 2026;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function nullableText(value: unknown): string | null {
  const valueText = text(value).trim();
  return valueText || null;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(university|college|the|state university)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function safeJson(url: string, revalidate: number): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      next: { revalidate },
      headers: { "user-agent": "LAP Live Sports/5.0" },
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

function compactDate(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function conferenceFromTeam(team: Record<string, unknown>) {
  const groups = asArray<Record<string, unknown>>(team.groups);
  const direct = groups.map((group) => text(group.name, text(group.shortName))).find(Boolean);
  if (direct) return direct;
  const standingSummary = text(team.standingSummary);
  return standingSummary && !/^\d+(st|nd|rd|th)\b/i.test(standingSummary) ? standingSummary : null;
}

function parseTeam(entry: unknown, division: CollegeDivision): CollegeTeam | null {
  const wrapper = asRecord(entry);
  const team = Object.keys(asRecord(wrapper.team)).length ? asRecord(wrapper.team) : wrapper;
  const id = text(team.id);
  const name = text(team.displayName, text(team.name));
  if (!id || !name) return null;
  const logos = asArray<Record<string, unknown>>(team.logos);
  return {
    id,
    name,
    shortName: text(team.shortDisplayName, name),
    location: text(team.location, name),
    nickname: text(team.name),
    abbreviation: text(team.abbreviation),
    logo: nullableText(team.logo) || logos.map((logo) => nullableText(logo.href)).find(Boolean) || null,
    conference: conferenceFromTeam(team),
    color: nullableText(team.color),
    alternateColor: nullableText(team.alternateColor),
    division,
  };
}

async function loadTeams(division: CollegeDivision): Promise<CollegeTeam[]> {
  const group = COLLEGE_DIVISIONS[division].espnGroup;
  const json = await safeJson(`${ESPN_SITE}/teams?limit=700&groups=${group}`, 6 * 60 * 60);
  if (!json) return [];
  const sports = asArray<Record<string, unknown>>(asRecord(json).sports);
  const leagues = asArray<Record<string, unknown>>(sports[0]?.leagues);
  const teams = asArray(leagues[0]?.teams);
  return teams.map((entry) => parseTeam(entry, division)).filter((item): item is CollegeTeam => Boolean(item));
}

function parseCompetitor(value: unknown) {
  const competitor = asRecord(value);
  const team = asRecord(competitor.team);
  const records = asArray<Record<string, unknown>>(competitor.records);
  const logos = asArray<Record<string, unknown>>(team.logos);
  return {
    id: nullableText(team.id),
    name: text(team.displayName, text(team.shortDisplayName, "Time não identificado")),
    logo: nullableText(team.logo) || logos.map((logo) => nullableText(logo.href)).find(Boolean) || null,
    score: competitor.score === undefined || competitor.score === null || competitor.score === "" ? null : String(competitor.score),
    record: records.map((record) => nullableText(record.summary)).find(Boolean) || null,
  };
}

function parseGames(json: unknown): CollegeGame[] {
  return asArray<Record<string, unknown>>(asRecord(json).events).flatMap((event) => {
    const competition = asArray<Record<string, unknown>>(event.competitions)[0];
    if (!competition) return [];
    const competitors = asArray<Record<string, unknown>>(competition.competitors);
    const home = competitors.find((item) => text(item.homeAway) === "home");
    const away = competitors.find((item) => text(item.homeAway) === "away");
    if (!home || !away) return [];
    const statusType = asRecord(asRecord(event.status).type);
    const rawState = text(statusType.state);
    const state: CollegeGame["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
    const venue = asRecord(competition.venue);
    const broadcasts = asArray<Record<string, unknown>>(competition.broadcasts);
    const broadcast = broadcasts.flatMap((item) => asArray(item.names)).map((name) => text(name)).find(Boolean) || null;
    return [{
      id: text(event.id),
      date: nullableText(event.date),
      status: text(statusType.shortDetail, text(statusType.detail, "Agendado")),
      state,
      venue: nullableText(venue.fullName),
      broadcast,
      home: parseCompetitor(home),
      away: parseCompetitor(away),
    }];
  });
}

async function loadUpcomingGames(division: CollegeDivision): Promise<CollegeGame[]> {
  const from = new Date();
  const to = new Date(from.getTime() + 70 * 24 * 60 * 60 * 1000);
  const group = COLLEGE_DIVISIONS[division].espnGroup;
  const url = `${ESPN_SITE}/scoreboard?groups=${group}&limit=200&dates=${compactDate(from)}-${compactDate(to)}`;
  const json = await safeJson(url, 5 * 60);
  return json ? parseGames(json) : [];
}

function findHistoryRows(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 7) return [];
  if (Array.isArray(value)) {
    return value.flatMap((item) => findHistoryRows(item, depth + 1));
  }
  const record = asRecord(value);
  if (!Object.keys(record).length) return [];
  const keys = Object.keys(record).map((key) => key.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const hasSeason = keys.some((key) => ["year", "season"].includes(key));
  const hasChampion = keys.some((key) => key.includes("champion"));
  const nested = Object.values(record).flatMap((item) => findHistoryRows(item, depth + 1));
  return hasSeason && hasChampion ? [record, ...nested] : nested;
}

function pickKey(record: Record<string, unknown>, candidates: string[]) {
  const entries = Object.entries(record);
  for (const candidate of candidates) {
    const found = entries.find(([key]) => key.toLowerCase().replace(/[^a-z0-9]/g, "") === candidate);
    if (found) return nullableText(found[1]);
  }
  return null;
}

function parseChampionshipHistory(json: unknown): ChampionshipRow[] {
  const rows = findHistoryRows(json);
  const parsed = rows.flatMap((row) => {
    const season = pickKey(row, ["year", "season"]);
    const champion = pickKey(row, ["champion", "nationalchampion", "winner"]);
    if (!season || !champion) return [];
    return [{
      season,
      champion,
      coach: pickKey(row, ["coach", "headcoach"]),
      score: pickKey(row, ["score", "result"]),
      runnerUp: pickKey(row, ["runnerup", "runnerupteam", "secondplace"]),
      site: pickKey(row, ["site", "location", "venue"]),
      selector: pickKey(row, ["selectingorganization", "selector", "organization"]),
    }];
  });
  return Array.from(new Map(parsed.map((row) => [`${row.season}|${row.champion}|${row.selector || ""}`, row])).values())
    .sort((a, b) => Number.parseInt(b.season, 10) - Number.parseInt(a.season, 10));
}

export async function loadChampionshipHistory(division: CollegeDivision): Promise<ChampionshipRow[]> {
  const path = COLLEGE_DIVISIONS[division].ncaaPath;
  const json = await safeJson(`${NCAA_API}/history/football/${path}`, 24 * 60 * 60);
  return json ? parseChampionshipHistory(json) : [];
}

async function loadDivisionSnapshot(division: CollegeDivision): Promise<CollegeDivisionSnapshot> {
  const [teams, games, championshipHistory] = await Promise.all([
    loadTeams(division),
    loadUpcomingGames(division),
    loadChampionshipHistory(division),
  ]);
  const successful = [teams.length > 0, games.length > 0, championshipHistory.length > 0].filter(Boolean).length;
  return {
    division,
    label: COLLEGE_DIVISIONS[division].label,
    teams,
    games,
    championshipHistory,
    generatedAt: new Date().toISOString(),
    sourceStatus: successful === 3 ? "ok" : successful > 0 ? "partial" : "unavailable",
  };
}

export async function getCollegeFootballHub(): Promise<CollegeFootballHub> {
  const [fbs, fcs, d2, d3] = await Promise.all([
    loadDivisionSnapshot("fbs"),
    loadDivisionSnapshot("fcs"),
    loadDivisionSnapshot("d2"),
    loadDivisionSnapshot("d3"),
  ]);
  return {
    season: CURRENT_SEASON,
    generatedAt: new Date().toISOString(),
    divisions: { fbs, fcs, d2, d3 },
  };
}

function parseRoster(json: unknown): CollegePlayer[] {
  const root = asRecord(json);
  const groups = asArray<Record<string, unknown>>(root.athletes);
  const rawAthletes = groups.flatMap((group) => {
    const items = asArray(group.items);
    return items.length ? items : [group];
  });
  return rawAthletes.flatMap((value) => {
    const athlete = asRecord(value);
    const id = text(athlete.id);
    const name = text(athlete.fullName, text(athlete.displayName));
    if (!id || !name) return [];
    const position = asRecord(athlete.position);
    const experience = asRecord(athlete.experience);
    const birthPlace = asRecord(athlete.birthPlace);
    const headshot = asRecord(athlete.headshot);
    return [{
      id,
      name,
      jersey: nullableText(athlete.jersey),
      position: nullableText(position.abbreviation) || nullableText(position.displayName),
      classYear: nullableText(experience.displayValue) || nullableText(athlete.class),
      height: nullableText(athlete.displayHeight),
      weight: nullableText(athlete.displayWeight),
      hometown: [nullableText(birthPlace.city), nullableText(birthPlace.state)].filter(Boolean).join(", ") || null,
      headshot: nullableText(headshot.href),
    }];
  });
}

function parseSchedule(json: unknown, teamId: string): CollegeTeamScheduleItem[] {
  return asArray<Record<string, unknown>>(asRecord(json).events).flatMap((event) => {
    const competition = asArray<Record<string, unknown>>(event.competitions)[0];
    if (!competition) return [];
    const competitors = asArray<Record<string, unknown>>(competition.competitors);
    const own = competitors.find((item) => text(asRecord(item.team).id) === teamId);
    const opponent = competitors.find((item) => text(asRecord(item.team).id) !== teamId);
    if (!own || !opponent) return [];
    const ownTeam = asRecord(own.team);
    const opponentTeam = asRecord(opponent.team);
    const opponentLogos = asArray<Record<string, unknown>>(opponentTeam.logos);
    const statusType = asRecord(asRecord(event.status).type);
    const rawState = text(statusType.state);
    const state: CollegeTeamScheduleItem["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
    const homeAwayRaw = text(own.homeAway);
    const homeAway: CollegeTeamScheduleItem["homeAway"] = competition.neutralSite === true ? "neutral" : homeAwayRaw === "home" || homeAwayRaw === "away" ? homeAwayRaw : null;
    const venue = asRecord(competition.venue);
    return [{
      id: text(event.id),
      date: nullableText(event.date),
      status: text(statusType.shortDetail, text(statusType.detail, "Agendado")),
      state,
      homeAway,
      opponent: text(opponentTeam.displayName, text(opponentTeam.shortDisplayName, "Adversário")),
      opponentLogo: nullableText(opponentTeam.logo) || opponentLogos.map((logo) => nullableText(logo.href)).find(Boolean) || null,
      teamScore: own.score === undefined || own.score === null || own.score === "" ? null : String(own.score),
      opponentScore: opponent.score === undefined || opponent.score === null || opponent.score === "" ? null : String(opponent.score),
      venue: nullableText(venue.fullName),
    }];
  });
}

async function loadVenue(teamId: string): Promise<CollegeVenue> {
  const fallback: CollegeVenue = { name: null, city: null, state: null, capacity: null, indoor: null, grass: null };
  const core = await safeJson(`${ESPN_CORE}/seasons/${CURRENT_SEASON}/types/2/teams/${teamId}?lang=en&region=us`, 24 * 60 * 60);
  if (!core) return fallback;
  const venue = asRecord(asRecord(core).venue);
  let venueData: unknown = venue;
  const ref = nullableText(venue.$ref);
  if (ref) venueData = await safeJson(ref, 24 * 60 * 60) || venue;
  const record = asRecord(venueData);
  const address = asRecord(record.address);
  return {
    name: nullableText(record.fullName),
    city: nullableText(address.city),
    state: nullableText(address.state),
    capacity: typeof record.capacity === "number" ? record.capacity : Number.isFinite(Number(record.capacity)) ? Number(record.capacity) : null,
    indoor: typeof record.indoor === "boolean" ? record.indoor : null,
    grass: typeof record.grass === "boolean" ? record.grass : null,
  };
}

function championshipMatchesTeam(row: ChampionshipRow, team: CollegeTeam) {
  const champion = normalize(row.champion);
  const candidates = [team.location, team.shortName, team.name, team.abbreviation].map(normalize).filter(Boolean);
  return candidates.some((candidate) => candidate.length >= 3 && (champion === candidate || champion.includes(candidate) || candidate.includes(champion)));
}

export async function getCollegeTeamDetail(teamId: string, division: CollegeDivision): Promise<CollegeTeamDetail | null> {
  const [teamJson, rosterJson, scheduleJson, venue, history] = await Promise.all([
    safeJson(`${ESPN_SITE}/teams/${teamId}`, 6 * 60 * 60),
    safeJson(`${ESPN_SITE}/teams/${teamId}/roster`, 6 * 60 * 60),
    safeJson(`${ESPN_SITE}/teams/${teamId}/schedule?season=${CURRENT_SEASON}`, 30 * 60),
    loadVenue(teamId),
    loadChampionshipHistory(division),
  ]);
  if (!teamJson) return null;
  const teamRoot = asRecord(teamJson);
  const team = parseTeam(teamRoot.team || teamRoot, division);
  if (!team) return null;
  const record = nullableText(asRecord(teamRoot.team).standingSummary) || nullableText(teamRoot.standingSummary);
  const titles = history.filter((row) => championshipMatchesTeam(row, team));
  const roster = rosterJson ? parseRoster(rosterJson) : [];
  const schedule = scheduleJson ? parseSchedule(scheduleJson, teamId) : [];
  const successful = [roster.length > 0, schedule.length > 0, Boolean(venue.name), history.length > 0].filter(Boolean).length;
  return {
    team,
    venue,
    roster,
    schedule,
    titles,
    titleCount: titles.length,
    record,
    sourceStatus: successful >= 3 ? "ok" : successful > 0 ? "partial" : "unavailable",
    generatedAt: new Date().toISOString(),
  };
}
