import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameCenter } from "@/components/game-center";
import { getGameDetails, type SportId, SPORTS } from "@/lib/live-data";

type PageProps = { params: Promise<{ sport: string; id: string }>; searchParams: Promise<{ torneio?: string }> };

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { sport, id } = await params;
  const { torneio } = await searchParams;
  if (!SPORTS.some((item) => item.id === sport)) return { title: "Partida não encontrada | LAP" };
  const details = await getGameDetails(sport as SportId, id, { worldCup: torneio === "copa-2026" });
  if (!details) return { title: "Partida não encontrada | LAP" };
  return { title: `${details.event.home.name} x ${details.event.away.name} | LAP`, description: `Placar, timeline e estatísticas de ${details.event.home.name} x ${details.event.away.name} na LAP.` };
}

export default async function GamePage({ params, searchParams }: PageProps) {
  const { sport, id } = await params;
  const { torneio } = await searchParams;
  if (!SPORTS.some((item) => item.id === sport)) notFound();
  const worldCup = torneio === "copa-2026";
  const details = await getGameDetails(sport as SportId, id, { worldCup });
  if (!details) notFound();

  const eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lap.local"}/jogos/${sport}/${id}${worldCup ? "?torneio=copa-2026" : ""}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${details.event.home.name} vs ${details.event.away.name}`,
    startDate: details.event.startTime || undefined,
    eventStatus: details.event.state === "post" ? "https://schema.org/EventCompleted" : details.event.state === "in" ? "https://schema.org/EventInProgress" : "https://schema.org/EventScheduled",
    location: details.event.venue ? { "@type": "Place", name: details.event.venue } : undefined,
    url: eventUrl,
    homeTeam: { "@type": "SportsTeam", name: details.event.home.name },
    awayTeam: { "@type": "SportsTeam", name: details.event.away.name },
  };

  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><GameCenter initialDetails={details} worldCup={worldCup} /></>;
}
