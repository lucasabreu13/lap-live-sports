import { eventDisplayTitle } from "@/lib/event-presentation";
import type { LivePayload, NewsItem, ScoreItem, SportId } from "@/lib/live-data";
import { loadEditorialNews } from "@/lib/providers/editorial-provider";
import {
  loadEspnCalendar,
  loadEspnGolfLeaderboard,
  loadEspnScores,
  loadEspnStandings,
  type EspnCalendarItem,
  type EspnStandingGroup,
} from "@/lib/providers/espn-provider";
import { loadGoogleNewsBriefs } from "@/lib/providers/google-news-provider";
import { providerUnavailable, type ProviderResult, type ProviderStatus } from "@/lib/providers/provider-types";
import { loadStaticSportMap } from "@/lib/providers/static-sport-provider";
import { loadResilientLivePayload } from "@/lib/providers/supabase-cache-provider";
import type { SportHubConfig, SportHubDetails } from "@/lib/sport-hubs/types";

function eventTime(event: ScoreItem) {
  if (!event.startTime) return Number.MAX_SAFE_INTEGER;
  const time = new Date(event.startTime).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function eventKey(event: ScoreItem) {
  return `${event.sportId}:${event.id}`;
}

function sortEvents(events: ScoreItem[]) {
  const phase = (event: ScoreItem) => event.state === "in" ? 0 : event.state === "pre" ? 1 : event.state === "post" ? 2 : 3;
  return [...events].sort((a, b) => {
    const phaseDifference = phase(a) - phase(b);
    if (phaseDifference) return phaseDifference;
    return a.state === "post" ? eventTime(b) - eventTime(a) : eventTime(a) - eventTime(b);
  });
}

function uniqueEvents(cached: ScoreItem[], direct: ScoreItem[]) {
  const map = new Map(cached.map((event) => [eventKey(event), event]));
  for (const event of direct) map.set(eventKey(event), event);
  return sortEvents([...map.values()]);
}

function eventOptions(sportId: SportId) {
  if (sportId === "formula1") return { dates: String(new Date().getUTCFullYear()), limit: 100 };
  if (sportId === "basquete") return { daysBack: 240, daysAhead: 180, limit: 500 };
  if (sportId === "beisebol") return { daysBack: 45, daysAhead: 45, limit: 300 };
  return { dates: null, limit: 200 };
}

function calendarFromEvents(events: ScoreItem[]): EspnCalendarItem[] {
  return events.map((event) => ({
    id: event.id,
    eventId: event.id,
    title: eventDisplayTitle(event),
    competition: event.league,
    startTime: event.startTime,
    status: event.status,
    state: event.state,
  }));
}

function feedEvents(payload: LivePayload | null, sportId: SportId) {
  return payload?.feeds.find((feed) => feed.id === sportId)?.scores ?? [];
}

function feedStatus(payload: LivePayload | null, sportId: SportId): ProviderStatus {
  return payload?.feeds.find((feed) => feed.id === sportId)?.sourceStatus ?? "unavailable";
}

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values())
    .sort((a, b) => {
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    })
    .slice(0, 10);
}

async function loadDirectEvents(config: SportHubConfig) {
  if (!config.eventPaths.length) return [] as ProviderResult<ScoreItem[]>[];
  return Promise.all(config.eventPaths.map((path) => loadEspnScores(config.sportId, path, eventOptions(config.sportId))));
}

async function loadRanking(config: SportHubConfig): Promise<ProviderResult<EspnStandingGroup[]>> {
  if (config.rankingProvider === "golf-leaderboard") return loadEspnGolfLeaderboard(config.eventPaths[0]);
  if (config.rankingProvider === "standings" && config.standingsPath) return loadEspnStandings(config.standingsPath, config.rankingTitle);
  return providerUnavailable([], undefined, "Classificação em atualização.");
}

async function loadCalendar(config: SportHubConfig) {
  if (config.sportId === "formula1" && config.eventPaths[0]) {
    return loadEspnCalendar(config.eventPaths[0], config.primaryCompetition, { dates: String(new Date().getUTCFullYear()), limit: 100 });
  }
  return providerUnavailable<EspnCalendarItem[]>([], undefined, "Calendário em atualização.");
}

export async function loadSportHubDetails(sportId: SportId): Promise<SportHubDetails | null> {
  const staticResult = loadStaticSportMap(sportId);
  if (!staticResult.data) return null;
  const { sport, hub: config } = staticResult.data;

  const [payloadResult, directResults, rankingResult, calendarResult, editorialResult] = await Promise.all([
    loadResilientLivePayload(),
    loadDirectEvents(config),
    loadRanking(config),
    loadCalendar(config),
    loadEditorialNews(sportId, 24),
  ]);
  const payload = payloadResult.data;
  const briefResult = await loadGoogleNewsBriefs(sportId, payload);
  const directEvents = directResults.flatMap((result) => result.data);
  const events = uniqueEvents(feedEvents(payload, sportId), directEvents);
  const calendar = calendarResult.data.length ? calendarResult.data : calendarFromEvents(events);
  const payloadNews = [
    ...(payload?.editorial ?? []).filter((item) => item.sportId === sportId),
    ...(payload?.feeds.find((feed) => feed.id === sportId)?.news ?? []),
  ];
  const news = uniqueNews([...editorialResult.data, ...briefResult.data, ...payloadNews]);
  const directStatus = directResults.some((result) => result.status === "live") ? "live" : directResults.some((result) => result.status === "stale") ? "stale" : null;
  const eventsStatus = events.length ? directStatus ?? feedStatus(payload, sportId) : "unavailable";

  return {
    sport,
    config,
    events,
    live: events.filter((event) => event.state === "in"),
    upcoming: events.filter((event) => event.state === "pre"),
    recent: events.filter((event) => event.state === "post"),
    calendar,
    standings: rankingResult.data,
    news,
    generatedAt: payload?.generatedAt ?? new Date().toISOString(),
    availability: {
      events: eventsStatus,
      calendar: calendarResult.data.length ? calendarResult.status : events.length ? eventsStatus : "unavailable",
      standings: rankingResult.status,
      news: news.length ? (briefResult.status === "stale" ? "stale" : "live") : "unavailable",
    },
  };
}
