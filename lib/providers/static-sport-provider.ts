import { SPORTS, type SportId } from "@/lib/live-data";
import { getSportDataBlueprint } from "@/lib/sport-data-blueprints";
import { getSportHubConfig } from "@/lib/sport-hubs/config";
import { providerLive, providerUnavailable } from "@/lib/providers/provider-types";

export function loadStaticSportMap(sportId: SportId) {
  const sport = SPORTS.find((item) => item.id === sportId);
  const blueprint = getSportDataBlueprint(sportId);
  const hub = getSportHubConfig(sportId);
  return sport && blueprint && hub
    ? providerLive({ sport, blueprint, hub })
    : providerUnavailable(null, undefined, "Modalidade em preparação.");
}
