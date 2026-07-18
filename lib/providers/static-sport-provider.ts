import { SPORTS, type SportId } from "@/lib/live-data";
import { getSportDataBlueprint } from "@/lib/sport-data-blueprints";
import { providerLive, providerUnavailable } from "@/lib/providers/provider-types";

export function loadStaticSportMap(sportId: SportId) {
  const sport = SPORTS.find((item) => item.id === sportId);
  const blueprint = getSportDataBlueprint(sportId);
  return sport && blueprint
    ? providerLive({ sport, blueprint })
    : providerUnavailable(null, undefined, "Modalidade em preparação.");
}
