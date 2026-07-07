"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { GameAlertButton } from "@/components/game-alert-button";
import { LapHeader } from "@/components/lap-header";
import type { GameDetails } from "@/lib/live-data";

type Tab = "resumo" | "linha" | "estatisticas" | "escalacoes" | "contexto";

function formattedDate(value: string | null) {
  if (!value) return "HorÃ¡rio a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "HorÃ¡rio a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function phase(event: GameDetails["event"]) {
  if (event.state === "in") return "AO VIVO";
  if (event.state === "post") return "ENCERRADO";
  if (event.state === "pre") return "EM BREVE";
  return event.status;
}

function GameTabContent({ details, tab }: { details: GameDetails; tab: Tab }) {
  if (tab === "linha") return <section className="game-panel"><h2>Linha do tempo</h2>{details.timeline.length ? <ol className="timeline">{details.timeline.map((item) => <li key={item.id} className={item.scoring ? "timeline__item timeline__item--score" : "timeline__item"}><div><strong>{item.clock || "â€¢"}</strong><span>{item.period ? `PerÃ­odo ${item.period}` : "AtualizaÃ§Ã£o"}</span></div><p>{item.text}</p>{item.homeScore !== null && item.awayScore !== null && <small>{item.homeScore} Ã— {item.awayScore}</small>}</li>)}</ol> : <p className="game-panel__empty">Os lances confirmados aparecem aqui durante a partida.</p>}</section>;

  if (tab === "estatisticas") return <section className="game-panel"><h2>EstatÃ­sticas</h2>{details.teamStats.length ? <div className="game-stats">{details.teamStats.map((team) => <article className="game-stats__team" key={team.team}><header>{team.logo && <img src={team.logo} alt="" width="28" height="28" />}<h3>{team.team}</h3></header><dl>{team.stats.map((stat) => <div key={`${team.team}-${stat.label}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></article>)}</div> : <p className="game-panel__empty">As estatÃ­sticas ainda nÃ£o foram disponibilizadas pela competiÃ§Ã£o.</p>}</section>;

  if (tab === "escalacoes") return <section className="game-panel"><h2>EscalaÃ§Ãµes</h2>{details.lineups.length ? <div className="lineups">{details.lineups.map((team) => <article className="lineup-card" key={team.team}><h3>{team.team}</h3><ol>{team.players.map((player) => <li key={player}>{player}</li>)}</ol></article>)}</div> : <p className="game-panel__empty">As escalaÃ§Ãµes aparecem quando forem confirmadas pela competiÃ§Ã£o.</p>}</section>;

  if (tab === "contexto") return <section className="game-panel"><div className="game-context-grid"><article className="game-context-card"><p className="game-panel__eyebrow">NotÃ­cias relacionadas</p><h2>O que estÃ¡ em foco</h2>{details.headlines.length ? <ul>{details.headlines.map((headline) => <li key={headline}>{headline}</li>)}</ul> : <p>As notÃ­cias relacionadas aparecem conforme a fonte atualiza a partida.</p>}</article><article className="game-context-card"><p className="game-panel__eyebrow">Confrontos recentes</p><h2>HistÃ³rico do duelo</h2><p>A LAP mostra o histÃ³rico direto quando a competiÃ§Ã£o disponibiliza esse dado. NÃ£o exibimos nÃºmeros estimados ou inventados.</p></article><article className="game-context-card"><p className="game-panel__eyebrow">InformaÃ§Ãµes oficiais</p><h2>Notas da partida</h2>{details.notes.length ? <ul>{details.notes.map((note) => <li key={note}>{note}</li>)}</ul> : <p>Novas informaÃ§Ãµes aparecerÃ£o aqui assim que forem confirmadas.</p>}</article></div></section>;

  return <section className="game-panel game-panel--summary"><div className="game-summary-grid"><article><p className="game-panel__eyebrow">SituaÃ§Ã£o</p><h2>{phase(details.event)}</h2><p>{details.event.status}</p></article><article><p className="game-panel__eyebrow">Local</p><h2>{details.event.venue || "A confirmar"}</h2><p>{details.event.broadcast ? `TransmissÃ£o: ${details.event.broadcast}` : "TransmissÃ£o em atualizaÃ§Ã£o."}</p></article></div>{details.headlines.length ? <div className="game-headlines"><p className="game-panel__eyebrow">Na LAP</p><h2>O que estÃ¡ em foco</h2><ul>{details.headlines.slice(0, 4).map((headline) => <li key={headline}>{headline}</li>)}</ul></div> : null}</section>;
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
  }, [details.event.state]);

  useEffect(() => {
    if (!("EventSource" in window)) return;
    const source = new EventSource("/api/live/stream");
    const onScore = (message: Event) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as { eventId?: string };
        if (payload.eventId === event.id) void refresh();
      } catch { /* atualizaÃ§Ã£o periÃ³dica continua ativa */ }
    };
    source.addEventListener("score", onScore);
    return () => source.close();
  }, [event.id]);

  const tabs = useMemo(() => [["resumo", "Resumo"], ["linha", "Linha do tempo"], ["estatisticas", "EstatÃ­sticas"], ["escalacoes", "EscalaÃ§Ãµes"], ["contexto", "Contexto"]] as Array<[Tab, string]>, []);

  return <main><LapHeader activeSport={event.sportId} /><div className="shell game-page"><nav className="article-breadcrumb" aria-label="NavegaÃ§Ã£o estrutural"><Link href="/">InÃ­cio</Link><span>â€º</span>{worldCup && <><Link href="/copa-2026">Copa 2026</Link><span>â€º</span></>}<Link href={`/modalidades/${event.sportId}`}>{event.sportId}</Link></nav><section className="game-hero"><div className="game-hero__meta"><span className={event.state === "in" ? "live-label" : "status-label"}>{phase(event)}</span><span>{event.round || event.league.replace(/-/g, " ")}</span><FavoriteButton id={`event:${event.sportId}:${event.id}`} type="event" label={`${event.home.name} x ${event.away.name}`} href={eventUrl} /></div><p className="game-hero__competition">{worldCup ? "Copa do Mundo 2026" : event.league.replace(/-/g, " ")}</p><div className="scoreboard-hero"><article><img src={event.home.logo || "/icons/lap-icon.svg"} alt="" width="72" height="72"/><h1>{event.home.name}</h1>{event.home.record && <p>{event.home.record}</p>}</article><div className="scoreboard-hero__score"><strong>{event.home.score ?? "â€”"}<span>Ã—</span>{event.away.score ?? "â€”"}</strong><p>{event.state === "post" ? event.status : formattedDate(event.startTime)}</p></div><article><img src={event.away.logo || "/icons/lap-icon.svg"} alt="" width="72" height="72"/><h1>{event.away.name}</h1>{event.away.record && <p>{event.away.record}</p>}</article></div><div className="game-hero__footer"><span>{event.venue || "Local a confirmar"}</span><div className="game-hero__actions">{event.state !== "post" && <GameAlertButton eventId={`event:${event.sportId}:${event.id}`} label={`${event.home.name} x ${event.away.name}`} />}<button className="refresh-button" type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Atualizando" : "Atualizar jogo"}</button></div></div></section><div className="game-tabs" role="tablist" aria-label="Dados da partida">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div><GameTabContent details={details} tab={tab} /></div></main>;
}