import { getCachedLivePayload } from "@/lib/free-live-data";
import { getSportDataBlueprint } from "@/lib/sport-data-blueprints";
import { getGameDetails, SPORTS, type GameDetails, type ScoreItem, type SportId } from "@/lib/live-data";

function sameEvent(score: ScoreItem, sportId: SportId, eventId: string, worldCup = false) {
  return score.sportId === sportId && score.id === eventId && (!worldCup || Boolean(score.isWorldCup));
}

function eventTitle(event: ScoreItem) {
  return event.eventKind === "race" ? event.home.name : `${event.home.name} x ${event.away.name}`;
}

function fallbackNotes(event: ScoreItem) {
  const sport = SPORTS.find((item) => item.id === event.sportId);
  const blueprint = getSportDataBlueprint(event.sportId);
  return [
    event.venue ? `Local: ${event.venue}` : null,
    event.broadcast ? `Transmissão: ${event.broadcast}` : null,
    blueprint ? `Formato da modalidade: ${blueprint.primarySurface}` : sport?.description || null,
    "Mais detalhes aparecem aqui quando estiverem disponíveis.",
  ].filter((item): item is string => Boolean(item));
}

async function findCachedEvent(sportId: SportId, eventId: string, worldCup = false) {
  const payload = await getCachedLivePayload().catch(() => null);
  if (!payload) return null;
  const events = [
    ...payload.worldCup.events,
    ...payload.feeds.flatMap((feed) => feed.scores),
  ];
  return events.find((score) => sameEvent(score, sportId, eventId, worldCup)) ?? null;
}

function detailsFromScore(event: ScoreItem): GameDetails {
  return {
    event,
    timeline: [],
    teamStats: [],
    lineups: [],
    headlines: [
      `${eventTitle(event)} está na agenda da LAP.`,
      event.status ? `Status: ${event.status}.` : "Evento acompanhado pela LAP.",
    ],
    notes: fallbackNotes(event),
    sourceStatus: "ok",
    generatedAt: new Date().toISOString(),
  };
}

export async function getResilientGameDetails(sportId: SportId, eventId: string, options?: { worldCup?: boolean }): Promise<GameDetails | null> {
  const direct = await getGameDetails(sportId, eventId, options).catch(() => null);
  if (direct) return direct;

  const cached = await findCachedEvent(sportId, eventId, Boolean(options?.worldCup));
  return cached ? detailsFromScore(cached) : null;
}
