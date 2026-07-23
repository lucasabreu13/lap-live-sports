import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FootballCenter } from "@/components/football-center";
import { RichIndividualCenter } from "@/components/rich-individual-center";
import { RichTeamLeagueCenter } from "@/components/rich-team-league-center";
import { SportHubCenter } from "@/components/sport-hubs/sport-hub-center";
import { getFootballHubDetails } from "@/lib/football-hub-data";
import { getRefreshedRichIndividualHub } from "@/lib/refreshed-rich-individual-data";
import { getProLeagueHub } from "@/lib/rich-team-league-data";
import { loadSportHubDetails } from "@/lib/sport-hubs/load-sport-hub";
import { PUBLIC_SPORTS } from "@/lib/public-sports";

type PageProps = { params: Promise<{ sport: string }> };

function resolveSport(sport: string) {
  return PUBLIC_SPORTS.find((item) => item.id === sport) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  const selected = resolveSport(sport);
  if (!selected) return { title: "Modalidade não encontrada | LAP" };

  const descriptions: Partial<Record<typeof selected.id, string>> = {
    "futebol-americano": "NFL completa: times, jogadores, estádios, salários disponíveis, calendário, classificação e notícias.",
    basquete: "NBA completa: franquias, jogadores, arenas, salários disponíveis, calendário, classificação, salários disponíveis e notícias.",
    beisebol: "MLB completa: franquias, rosters, estádios, calendário, classificação e contexto da temporada.",
    formula1: "Fórmula 1: classificação de pilotos e equipes, próximas corridas, resultados, voltas rápidas, abandonos e pit stops.",
    tenis: "Tênis: rankings ATP e WTA com atualização automática, campeões recentes, Grand Slams e notícias.",
    ciclismo: "Tour de France: classificação geral, etapas, equipes, camisas e notícias.",
    golfe: "Golfe: OWGR e Rolex Rankings com atualização automática, torneios recentes, leaderboards e notícias.",
    surfe: "WSL Championship Tour e Brazilian Storm com ranking atualizado automaticamente, brasileiros e notícias.",
  };

  return {
    title: `${selected.name} | LAP Live Sports`,
    description: descriptions[selected.id] || `Notícias, agenda e resultados de ${selected.name} na LAP.`,
  };
}

export default async function SportPage({ params }: PageProps) {
  const { sport } = await params;
  const selected = resolveSport(sport);
  if (!selected) notFound();

  if (selected.id === "futebol") {
    const details = await getFootballHubDetails();
    return <FootballCenter details={details} />;
  }

  if (selected.id === "futebol-americano") {
    const hub = await getProLeagueHub("nfl");
    return <RichTeamLeagueCenter hub={hub} />;
  }

  if (selected.id === "basquete") {
    const hub = await getProLeagueHub("nba");
    return <RichTeamLeagueCenter hub={hub} />;
  }

  if (selected.id === "beisebol") {
    const hub = await getProLeagueHub("mlb");
    return <RichTeamLeagueCenter hub={hub} />;
  }

  if (["formula1", "tenis", "ciclismo", "golfe", "surfe"].includes(selected.id)) {
    const hub = await getRefreshedRichIndividualHub(selected.id);
    if (!hub) notFound();
    return <RichIndividualCenter hub={hub} />;
  }

  const details = await loadSportHubDetails(selected.id);
  if (!details) notFound();
  return <SportHubCenter details={details} />;
}
