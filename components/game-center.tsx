"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { LapHeader } from "@/components/lap-header";
import type { GameDetails } from "@/lib/live-data";

type Tab = "resumo" | "linha" | "estatisticas" | "escalacoes";

function formattedDate(value: string | null) {
  if (!value) return "Horário a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function phase(event: GameDetails["event"]) {
  if (event.state === "in") return "AO VIVO";
  if (event.state === "post") return "ENCERRADO";
  if (event.state === "pre") return "EM BREVE";
  return event.status;
}

function GameTabContent({ details, tab }: { details: GameDetails; tab: Tab }) {
  if (tab === "linha") {
    return <section className="game-panel"><h2>Timeline</h2>{details.timeline.length ? <ol className="timeline">{details.timeline.map((item) => <li key={item.id} className={item.scoring ? "timeline__item timeline__item--score" : "timeline__item"}><div><strong>{item.clock || "•"}</strong><span>{item.period ? `Período ${item.period}` : "Atualização"}</span></div><p>{item.text}</p>{item.homeScore !== null && item.awayScore !== null && <small>{item.homeScore} × {item.awayScore}</small>}</li>)}</ol> : <p className="game-panel__empty">Os lances confirmados aparecem aqui durante a partida.</p>}</section>;
  }
  if (tab === "estatisticas") {
    return <section className="game-panel"><h2>Estatísticas</h2>{details.teamStats.length ? <div className="game-stats">{details.teamStats.map((team) => <article className="game-stats__team" key={team.team}><header>{team.logo && <img src={team.logo} alt="" width="28" height="28" />}<h3>{team.team}</h3></header><dl>{team.stats.map((stat) => <div key={`${team.team}-${stat.label}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></article>)}</div> : <p className="game-panel__empty">As estatísticas desta partida ainda não foram disponibilizadas.</p>}</section>;
  }
  if (tab === "escalacoes") {
    return <section className="game-panel"><h2>Escalações</h2>{details.lineups.length ? <div className="lineups">{details.lineups.map((team) => <article className="lineup-card" key={team.team}><h3>{team.team}</h3><ol>{team.players.map((player) => <li key={player}>{player}</li>)}</ol></article>)}</div> : <p className="game-panel__empty">As escalações aparecem assim que forem confirmadas pela competição.</p>}</section>;
  }
  return <section className="game-panel game-panel--summary"><div className="game-summary-grid"><article><p className="game-panel__eyebrow">Situação</p><h2>{phase(details.event)}</h2><p>{details.event.status}</p></article><article><p className="game-panel__eyebrow">Local</p><h2>{details.event.venue || "A confirmar"}</h2><p>{details.event.broadcast ? `Transmissão: ${details.event.broadcast}` : "Informação de transmissão pode ser atualizada."}</p></article></div>{details.headlines.length ? <div className="game-headlines"><p className="game-panel__eyebrow">Na LAP</p><h2>O que está em foco</h2><ul>{details.headlines.map((headline) => <li key={headline}>{headline}</li>)}</ul></div> : null}{details.notes.length ? <div className="game-notes"><p className="game-panel__eyebrow">Informações da partida</p><ul>{details.notes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}</section>;
}

export function GameCenter({ initialDetails, worldCup }: { initialDetails: GameDetails; worldCup: boolean }) {
  const [details, setDetails] = useState(initialDetails);
  const [tab, setTab] = useState<Tab>("resumo");
  const [refreshing, setRefreshing] = useState(false);
  const event = details.event;
  const eventUrl = `/jogos/${event.sportId}/${event.id}${worldCup ? "?torneio=copa-2026" : ""}`;

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/games/${event.sportId}/${event.id}${worldCup ? "?torneio=copa-2026" : ""}`, { cache: "no-store" });
      if (response.ok) setDetails(await response.json() as GameDetails);
    } finally { setRefreshing(false); }
  }

  useEffect(() => {
    const interval = window.setInterval(() => void refresh(), details.event.state === "in" ? 15_000 : 30_000);
    return () => window.clearInterval(interval);
  });

  useEffect(() => {
    if (!("EventSource" in window)) return;
    const source = new EventSource("/api/live/stream");
    const onScore = (message: Event) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as { eventId?: string };
        if (payload.eventId === event.id) void refresh();
      } catch { /* Atualização periódica continua ativa. */ }
    };
    source.addEventListener("score", onScore);
    return () => source.close();
  }, [event.id]);

  const tabs = useMemo(() => [
    ["resumo", "Resumo"], ["linha", "Linha do tempo"], ["estatisticas", "Estatísticas"], ["escalacoes", "Escalações"],
  ] as Array<[Tab, string]>, []);

  return (
    <main>
      <LapHeader activeSport={event.sportId} />
      <div className="shell game-page">
        <nav className="article-breadcrumb" aria-label="Navegação estrutural"><Link href="/">Início</Link><span>›</span>{worldCup && <><Link href="/copa-2026">Copa 2026</Link><span>›</span></>}<Link href={`/modalidades/${event.sportId}`}>{event.sportId}</Link></nav>
        <section className="game-hero">
          <div className="game-hero__meta"><span className={event.state === "in" ? "live-label" : "status-label"}>{phase(event)}</span><span>{event.round || event.league.replace(/-/g, " ")}</span><FavoriteButton id={`event:${event.sportId}:${event.id}`} type="event" label={`${event.home.name} x ${event.away.name}`} href={eventUrl} /></div>
          <p className="game-hero__competition">{worldCup ? "Copa do Mundo 2026" : event.league.replace(/-/g, " ")}</p>
          <div className="scoreboard-hero"><article><img src={event.home.logo || "/icons/lap-icon.svg"} alt="" width="72" height="72"/><h1>{event.home.name}</h1>{event.home.record && <p>{event.home.record}</p>}</article><div className="scoreboard-hero__score"><strong>{event.home.score ?? "—"}<span>×</span>{event.away.score ?? "—"}</strong><p>{event.state === "post" ? event.status : formattedDate(event.startTime)}</p></div><article><img src={event.away.logo || "/icons/lap-icon.svg"} alt="" width="72" height="72"/><h1>{event.away.name}</h1>{event.away.record && <p>{event.away.record}</p>}</article></div>
          <div className="game-hero__footer"><span>{event.venue || "Local a confirmar"}</span><button className="refresh-button" type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Atualizando" : "Atualizar jogo"}</button></div>
        </section>
        <div className="game-tabs" role="tablist" aria-label="Dados da partida">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
        <GameTabContent details={details} tab={tab} />
      </div>
    </main>
  );
}
