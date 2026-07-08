import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LapDashboard } from "@/components/lap-dashboard";
import { NflCenter } from "@/components/nfl-center";
import { getNflCenterDetails } from "@/lib/nfl-data";
import { SPORTS, type SportId } from "@/lib/live-data";

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

  if (selected.id === "futebol-americano") {
    const details = await getNflCenterDetails();
    return <NflCenter details={details} />;
  }

  return <LapDashboard initialSport={selected.id as SportId} />;
}
