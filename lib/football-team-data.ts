import { FOOTBALL_COMPETITIONS, type NewsItem } from "@/lib/live-data";
import { getCachedLivePayload } from "@/lib/free-live-data";

type AnyRecord = Record<string, unknown>;
function rec(value: unknown): AnyRecord { return value && typeof value === "object" ? value as AnyRecord : {}; }
function arr<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function text(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function nullable(value: unknown) { const result = text(value).trim(); return result || null; }
function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export type FootballPlayer = { id: string; name: string; position: string | null; jersey: string | null; age: number | null; height: string | null; weight: string | null; nationality: string | null; headshot: string | null };
export type FootballTeamDetail = { competitionId: string; competitionName: string; team: { id: string; name: string; shortName: string; abbreviation: string; logo: string | null; color: string | null }; roster: FootballPlayer[]; record: string | null; standing: string | null; venue: string | null; news: NewsItem[] };

async function safeJson(url: string, revalidate = 21600) {
  try { const response = await fetch(url, { next: { revalidate }, headers: { "user-agent": "LAP Live Sports/7.0" } }); return response.ok ? await response.json() : null; } catch { return null; }
}

function parsePlayer(value: unknown): FootballPlayer | null {
  const athlete = rec(value);
  const id = text(athlete.id);
  const name = text(athlete.fullName || athlete.displayName);
  if (!id || !name) return null;
  const position = rec(athlete.position);
  const headshot = rec(athlete.headshot);
  const citizenship = rec(athlete.citizenship);
  const age = Number.isFinite(Number(athlete.age)) ? Number(athlete.age) : null;
  return { id, name, position: nullable(position.abbreviation) || nullable(position.displayName), jersey: nullable(athlete.jersey), age, height: nullable(athlete.displayHeight), weight: nullable(athlete.displayWeight), nationality: nullable(citizenship.name), headshot: nullable(headshot.href) };
}

export async function getFootballTeamDetail(competitionId: string, teamSlug: string): Promise<FootballTeamDetail | null> {
  const competition = FOOTBALL_COMPETITIONS.find((item) => item.id === competitionId);
  if (!competition) return null;
  const teamsJson = await safeJson(`https://site.api.espn.com/apis/site/v2/sports/${competition.espnPath}/teams?limit=100`);
  const sports = arr<AnyRecord>(rec(teamsJson).sports);
  const leagues = arr<AnyRecord>(sports[0]?.leagues);
  const teamWrappers = arr<AnyRecord>(leagues[0]?.teams);
  const teamRaw = teamWrappers.map((item) => rec(item.team)).find((team) => slugify(text(team.displayName || team.name)) === teamSlug || slugify(text(team.shortDisplayName)) === teamSlug);
  if (!teamRaw) return null;
  const id = text(teamRaw.id);
  if (!id) return null;
  const [rosterJson, teamJson, payload] = await Promise.all([
    safeJson(`https://site.api.espn.com/apis/site/v2/sports/${competition.espnPath}/teams/${id}/roster`),
    safeJson(`https://site.api.espn.com/apis/site/v2/sports/${competition.espnPath}/teams/${id}`),
    getCachedLivePayload().catch(() => null),
  ]);
  const rosterGroups = arr<AnyRecord>(rec(rosterJson).athletes);
  const roster = rosterGroups.flatMap((group) => {
    const items = arr(group.items);
    return (items.length ? items : [group]).map(parsePlayer).filter((player): player is FootballPlayer => Boolean(player));
  }).sort((a, b) => (a.position || "ZZ").localeCompare(b.position || "ZZ") || a.name.localeCompare(b.name));
  const root = rec(teamJson);
  const team = rec(root.team);
  const logos = arr<AnyRecord>(team.logos);
  const venue = rec(team.venue);
  const teamName = text(team.displayName || teamRaw.displayName || teamRaw.name);
  const terms = [teamName, text(team.shortDisplayName), text(team.abbreviation)].map((value) => value.toLowerCase()).filter(Boolean);
  const feed = payload?.feeds.find((item) => item.id === "futebol");
  const news = [...(payload?.editorial ?? []), ...(feed?.news ?? [])].filter((item) => terms.some((term) => `${item.title} ${item.excerpt}`.toLowerCase().includes(term))).slice(0, 12);
  return {
    competitionId,
    competitionName: competition.name,
    team: { id, name: teamName, shortName: text(team.shortDisplayName || teamRaw.shortDisplayName || teamName), abbreviation: text(team.abbreviation || teamRaw.abbreviation), logo: nullable(team.logo) || logos.map((logo) => nullable(logo.href)).find(Boolean) || nullable(teamRaw.logo), color: nullable(team.color || teamRaw.color) },
    roster,
    record: nullable(team.record || root.record),
    standing: nullable(team.standingSummary || root.standingSummary),
    venue: nullable(venue.fullName),
    news,
  };
}

export { slugify as footballTeamSlug };
