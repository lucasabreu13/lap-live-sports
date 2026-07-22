import type { Metadata } from "next";
import { MatchCenterAgenda } from "@/components/match-center-agenda";
import { getCachedLivePayload } from "@/lib/free-live-data";
import { FOOTBALL_COMPETITIONS, SPORTS } from "@/lib/live-data";

export const metadata: Metadata = {
  title: "Agenda e Match Center",
  description: "Eventos ao vivo, próximos jogos, favoritos, calendário e centros de partida por modalidade na LAP.",
};

type PageProps = {
  searchParams: Promise<{ sport?: string | string[]; liga?: string | string[]; pais?: string | string[] }>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const [query, initialPayload] = await Promise.all([
    searchParams,
    getCachedLivePayload({ preferCached: true }).catch(() => null),
  ]);
  const requestedSport = firstParam(query.sport);
  const requestedCompetition = firstParam(query.liga);
  const requestedCountry = firstParam(query.pais)?.trim() ?? "";
  const initialCompetition = FOOTBALL_COMPETITIONS.some((item) => item.id === requestedCompetition) ? requestedCompetition : "all";
  const initialSport = initialCompetition !== "all" ? "futebol" : SPORTS.some((item) => item.id === requestedSport) ? requestedSport : "all";

  return <MatchCenterAgenda initialCompetition={initialCompetition} initialPayload={initialPayload} initialQuery={requestedCountry} initialSport={initialSport} />;
}
