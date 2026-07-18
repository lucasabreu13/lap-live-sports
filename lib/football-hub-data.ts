import { getCachedLivePayload } from "@/lib/free-live-data";
import { FOOTBALL_COMPETITIONS, type FootballCompetition, type NewsItem, type ScoreItem } from "@/lib/live-data";

export type FootballLeagueSummary = FootballCompetition & {
  live: number;
  upcoming: number;
  recent: number;
  total: number;
};

export type FootballHubDetails = {
  leagues: FootballLeagueSummary[];
  live: ScoreItem[];
  upcoming: ScoreItem[];
  recent: ScoreItem[];
  news: NewsItem[];
  generatedAt: string;
};

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function eventTime(event: ScoreItem) {
  if (!event.startTime) return 0;
  const time = new Date(event.startTime).getTime();
  return Number.isFinite(time) ? time : 0;
}

function scoreMatchesCompetition(score: ScoreItem, competition: FootballCompetition) {
  if (score.competitionId === competition.id) return true;
  const haystack = normalizedText(`${score.league} ${score.round || ""} ${score.country || ""}`);
  return [competition.name, competition.country, competition.espnPath.split("/").pop() || ""]
    .map(normalizedText)
    .some((term) => term.length > 3 && haystack.includes(term));
}

export async function getFootballHubDetails(): Promise<FootballHubDetails> {
  const payload = await getCachedLivePayload().catch(() => null);
  const footballFeed = payload?.feeds.find((feed) => feed.id === "futebol");
  const allScores = footballFeed?.scores ?? [];
  const live = allScores.filter((score) => score.state === "in");
  const upcoming = allScores.filter((score) => score.state === "pre").sort((a, b) => eventTime(a) - eventTime(b));
  const recent = allScores.filter((score) => score.state === "post").sort((a, b) => eventTime(b) - eventTime(a));

  const leagues = FOOTBALL_COMPETITIONS.map((competition) => {
    const matches = allScores.filter((score) => scoreMatchesCompetition(score, competition));
    return {
      ...competition,
      live: matches.filter((score) => score.state === "in").length,
      upcoming: matches.filter((score) => score.state === "pre").length,
      recent: matches.filter((score) => score.state === "post").length,
      total: matches.length,
    };
  });

  return {
    leagues,
    live,
    upcoming,
    recent,
    news: [...(payload?.editorial ?? []), ...(footballFeed?.news ?? [])]
      .filter((item) => item.sportId === "futebol")
      .slice(0, 10),
    generatedAt: payload?.generatedAt ?? new Date().toISOString(),
  };
}
