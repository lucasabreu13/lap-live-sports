import { SPORTS, type LivePayload, type SportId } from "@/lib/live-data";

export const HIDDEN_SPORT_IDS = new Set<SportId>([
  "softball",
  "volei",
  "rugby",
  "criquete",
  "mma",
  "natacao",
  "atletismo",
]);

export const PUBLIC_SPORTS = SPORTS.filter((sport) => !HIDDEN_SPORT_IDS.has(sport.id));

export function isPublicSportId(sportId: SportId) {
  return !HIDDEN_SPORT_IDS.has(sportId);
}

export function toPublicLivePayload(payload: LivePayload, options?: { includeWorldCup?: boolean }): LivePayload {
  const includeWorldCup = options?.includeWorldCup === true;
  return {
    ...payload,
    editorial: payload.editorial.filter((item) => isPublicSportId(item.sportId)),
    feeds: payload.feeds.filter((feed) => isPublicSportId(feed.id)),
    worldCup: includeWorldCup ? payload.worldCup : { ...payload.worldCup, events: [] },
  };
}
