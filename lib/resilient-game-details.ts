import { eventDisplayTitle } from "@/lib/event-presentation";
import { getSportDataBlueprint } from "@/lib/sport-data-blueprints";
import {
  SPORTS,
  getGameDetails,
  type GameDetails,
  type ScoreItem,
  type SportId,
} from "@/lib/live-data";
import {
  findEventAcrossEspnSchedules,
  findGameAcrossEspnPaths,
  getEspnPathsForSport,
} from "@/lib/providers/espn-provider";
import { findEventInCachedPayload } from "@/lib/providers/supabase-cache-provider";

function fallbackNotes(event: ScoreItem) {
  const sport = SPORTS.find((item) => item.id === event.sportId);
  const blueprint = getSportDataBlueprint(event.sportId);
  return [
    event.venue ? `Local: ${event.venue}` : null,
    event.broadcast ? `Transmissão: ${event.broadcast}` : null,
    blueprint ? `Como acompanhar: ${blueprint.primarySurface}` : sport?.description || null,
    "Próximos conteúdos aparecem quando disponíveis.",
  ].filter((item): item is string => Boolean(item));
}

export function detailsFromScore(event: ScoreItem, headlines?: string[], notes?: string[]): GameDetails {
  return {
    event,
    timeline: [],
    teamStats: [],
    lineups: [],
    headlines: headlines?.length ? headlines : [
      `${eventDisplayTitle(event)} está na agenda da LAP.`,
      event.status ? `Status: ${event.status}.` : "Evento acompanhado pela LAP.",
    ],
    notes: notes?.length ? notes : fallbackNotes(event),
    sourceStatus: "ok",
    generatedAt: new Date().toISOString(),
  };
}

export async function getResilientGameDetails(
  sportId: SportId,
  eventId: string,
  options?: { worldCup?: boolean },
): Promise<GameDetails | null> {
  const direct = await getGameDetails(sportId, eventId, options).catch(() => null);
  if (direct) return direct;

  const cached = await findEventInCachedPayload(sportId, eventId, Boolean(options?.worldCup));
  if (cached) return detailsFromScore(cached);

  const paths = getEspnPathsForSport(sportId);
  const alternate = await findGameAcrossEspnPaths(sportId, eventId, paths, options);
  if (alternate) return alternate;

  const scheduled = await findEventAcrossEspnSchedules(sportId, eventId, paths);
  if (scheduled) return detailsFromScore(scheduled);

  return null;
}
