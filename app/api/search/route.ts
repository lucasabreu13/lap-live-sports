import { NextRequest, NextResponse } from "next/server";
import { eventHref } from "@/lib/event-presentation";
import { getCachedLivePayload } from "@/lib/free-live-data";
import { FOOTBALL_COMPETITIONS, SPORTS } from "@/lib/live-data";
import { getProLeagueHub, PRO_LEAGUES, type ProLeagueId } from "@/lib/rich-team-league-data";

export const dynamic = "force-dynamic";

type SearchResult = { id: string; title: string; meta: string; href: string; kind: "matéria" | "jogo" | "modalidade" | "liga" | "time" | "atleta" };

type AnyRecord = Record<string, unknown>;
function rec(value: unknown): AnyRecord { return value && typeof value === "object" ? value as AnyRecord : {}; }
function arr<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function text(value: unknown) { return typeof value === "string" || typeof value === "number" ? String(value) : ""; }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); }

async function searchAthletes(query: string): Promise<SearchResult[]> {
  const configs = [
    { league: "nfl" as const, sport: "football", label: "NFL" },
    { league: "nba" as const, sport: "basketball", label: "NBA" },
    { league: "mlb" as const, sport: "baseball", label: "MLB" },
  ];
  const responses = await Promise.all(configs.map(async (config) => {
    try {
      const url = `https://sports.core.api.espn.com/v2/sports/${config.sport}/leagues/${config.league}/athletes?limit=1000&active=true&lang=en&region=us`;
      const response = await fetch(url, { next: { revalidate: 6 * 60 * 60 }, headers: { "user-agent": "LAP Live Sports/7.0" } });
      if (!response.ok) return [];
      const json = await response.json();
      const items = arr<AnyRecord>(rec(json).items);
      return items.flatMap((item) => {
        const name = text(item.fullName || item.displayName);
        if (!name || !normalize(name).includes(query)) return [];
        const teamRef = text(rec(item.team).$ref);
        const teamId = teamRef.match(/teams\/(\d+)/)?.[1] || "";
        const position = text(rec(item.position).abbreviation || rec(item.position).displayName);
        return [{ id: `athlete-${config.league}-${text(item.id)}`, title: name, meta: [config.label, position].filter(Boolean).join(" · "), href: teamId ? `/times/${config.league}/${teamId}` : `/modalidades/${PRO_LEAGUES[config.league].sportId}`, kind: "atleta" as const }];
      });
    } catch { return []; }
  }));
  return responses.flat().slice(0, 12);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("q")?.trim() || "";
  if (raw.length < 2) return NextResponse.json({ results: [] });
  const needle = normalize(raw);
  const matches = (value: string) => normalize(value).includes(needle);

  const [payload, hubs, athletes] = await Promise.all([
    getCachedLivePayload().catch(() => null),
    Promise.all((Object.keys(PRO_LEAGUES) as ProLeagueId[]).map((league) => getProLeagueHub(league).catch(() => null))),
    raw.length >= 3 ? searchAthletes(needle) : Promise.resolve([]),
  ]);

  const results: SearchResult[] = [];
  SPORTS.filter((sport) => matches(sport.name) || matches(sport.description || "")).forEach((sport) => results.push({ id: `sport-${sport.id}`, title: sport.name, meta: "Modalidade", href: `/modalidades/${sport.id}`, kind: "modalidade" }));
  FOOTBALL_COMPETITIONS.filter((competition) => matches(competition.name) || matches(competition.country)).forEach((competition) => results.push({ id: `league-${competition.id}`, title: competition.name, meta: `Liga · ${competition.country}`, href: `/campeonatos/${competition.id}`, kind: "liga" }));

  hubs.filter(Boolean).forEach((hub) => hub!.teams.filter((team) => matches(`${team.name} ${team.shortName} ${team.location} ${team.abbreviation}`)).forEach((team) => results.push({ id: `team-${hub!.config.id}-${team.id}`, title: team.name, meta: `Time · ${hub!.config.label}`, href: `/times/${hub!.config.id}/${team.id}`, kind: "time" })));

  if (payload) {
    [...payload.editorial, ...payload.feeds.flatMap((feed) => feed.news)].filter((item) => matches(`${item.title} ${item.excerpt} ${item.source}`)).forEach((item) => results.push({ id: `article-${item.id}`, title: item.title, meta: `${item.sportId} · ${item.source}`, href: item.internalUrl, kind: "matéria" }));
    payload.feeds.flatMap((feed) => feed.scores).filter((score) => matches(`${score.home.name} ${score.away.name} ${score.league} ${score.round || ""}`)).forEach((score) => results.push({ id: `score-${score.sportId}-${score.id}`, title: `${score.home.name} × ${score.away.name}`, meta: [score.league.replace(/-/g, " "), score.status].filter(Boolean).join(" · "), href: eventHref(score), kind: "jogo" }));
  }

  results.push(...athletes);
  return NextResponse.json({ results: Array.from(new Map(results.map((item) => [item.id, item])).values()).slice(0, 24) }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } });
}
