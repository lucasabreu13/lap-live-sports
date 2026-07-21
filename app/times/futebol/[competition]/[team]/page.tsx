import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FootballTeamPage } from "@/components/football-team-page";
import { getFootballTeamDetail } from "@/lib/football-team-data";

type PageProps = { params: Promise<{ competition: string; team: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { competition, team } = await params;
  const detail = await getFootballTeamDetail(competition, team);
  if (!detail) return { title: "Time não encontrado | LAP" };
  return { title: `${detail.team.name} | ${detail.competitionName} | LAP`, description: `Elenco, posição, idade, campanha e notícias de ${detail.team.name} na LAP.` };
}

export default async function FootballTeamRoute({ params }: PageProps) {
  const { competition, team } = await params;
  const detail = await getFootballTeamDetail(competition, team);
  if (!detail) notFound();
  return <FootballTeamPage detail={detail} />;
}
