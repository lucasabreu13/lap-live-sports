import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FootballCenter } from "@/components/football-center";
import { NflCenter } from "@/components/nfl-center";
import { SportHubCenter } from "@/components/sport-hubs/sport-hub-center";
import { getFootballHubDetails } from "@/lib/football-hub-data";
import { getNflCenterDetails } from "@/lib/nfl-data";
import { loadSportHubDetails } from "@/lib/sport-hubs/load-sport-hub";
import { SPORTS } from "@/lib/live-data";

type PageProps = { params: Promise<{ sport: string }> };

function resolveSport(sport: string) {
  return SPORTS.find((item) => item.id === sport) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { sport } = await params;
  const selected = resolveSport(sport);
  if (!selected) return { title: "Modalidade não encontrada | LAP" };

  return {
    title: `${selected.name} | LAP Live Sports`,
    description: `Notícias, agenda e resultados de ${selected.name} na LAP.`,
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
    const details = await getNflCenterDetails();
    return <NflCenter details={details} />;
  }

  const details = await loadSportHubDetails(selected.id);
  if (!details) notFound();
  return <SportHubCenter details={details} />;
}
