import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GameCenter } from "@/components/game-center";
import { VerifiedMatchInsights } from "@/components/verified-match-insights";
import { eventDisplayTitle, isSingleEvent } from "@/lib/event-presentation";
import { SPORTS, type SportId } from "@/lib/live-data";
import { getResilientGameDetails } from "@/lib/resilient-game-details";

type PageProps = { params: Promise<{ sport: string; id: string }>; searchParams: Promise<{ torneio?: string }> };

function metadataTitle(details: Awaited<ReturnType<typeof getResilientGameDetails>>) {
  if (!details) return "Partida não encontrada | LAP";
  return `${eventDisplayTitle(details.event)} | LAP`;
}

function metadataDescription(details: Awaited<ReturnType<typeof getResilientGameDetails>>) {
  if (!details) return undefined;
  return isSingleEvent(details.event)
    ? `Agenda, status e informações de ${details.event.home.name} na LAP.`
    : `Placar, lances, estatísticas e análise pré-jogo de ${eventDisplayTitle(details.event)} na LAP.`;
}

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const { sport, id } = await params;
  const { torneio } = await searchParams;
  if (!SPORTS.some((item) => item.id === sport)) return { title: "Partida não encontrada | LAP" };
  const details = await getResilientGameDetails(sport as SportId, id, { worldCup: torneio === "copa-2026" });
  return { title: metadataTitle(details), description: metadataDescription(details) };
}

export default async function GamePage({ params, searchParams }: PageProps) {
  const { sport, id } = await params;
  const { torneio } = await searchParams;
  if (!SPORTS.some((item) => item.id === sport)) notFound();
  const worldCup = torneio === "copa-2026";
  const details = await getResilientGameDetails(sport as SportId, id, { worldCup });
  if (!details) notFound();

  const eventUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://lap.local"}/jogos/${sport}/${id}${worldCup ? "?torneio=copa-2026" : ""}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: eventDisplayTitle(details.event, "vs"),
    startDate: details.event.startTime || undefined,
    eventStatus: details.event.state === "post" ? "https://schema.org/EventCompleted" : details.event.state === "in" ? "https://schema.org/EventInProgress" : "https://schema.org/EventScheduled",
    location: details.event.venue ? { "@type": "Place", name: details.event.venue } : undefined,
    url: eventUrl,
    ...(!isSingleEvent(details.event) ? {
      homeTeam: { "@type": "SportsTeam", name: details.event.home.name },
      awayTeam: { "@type": "SportsTeam", name: details.event.away.name },
    } : {}),
  };

  return <>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    <GameCenter initialDetails={details} worldCup={worldCup} />
    <VerifiedMatchInsights event={details.event} />
  </>;
}
