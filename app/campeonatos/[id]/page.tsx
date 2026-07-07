import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CompetitionCenter } from "@/components/competition-center";
import { FOOTBALL_COMPETITIONS, getCompetitionDetails } from "@/lib/live-data";

type PageProps = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function generateStaticParams() {
  return FOOTBALL_COMPETITIONS.map((competition) => ({ id: competition.id }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const competition = FOOTBALL_COMPETITIONS.find((item) => item.id === id);
  if (!competition) return { title: "Campeonato não encontrado | LAP" };
  return {
    title: `${competition.name} | LAP Live Sports`,
    description: `Tabela, jogos, resultados e notícias de ${competition.name} na LAP.`,
  };
}

export default async function CompetitionPage({ params }: PageProps) {
  const { id } = await params;
  const details = await getCompetitionDetails(id);
  if (!details) notFound();
  return <CompetitionCenter details={details} />;
}
