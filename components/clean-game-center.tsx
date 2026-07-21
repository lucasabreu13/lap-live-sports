"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { LapHeader } from "@/components/lap-header";
import { eventDisplayTitle, eventKindLabel, isSingleEvent } from "@/lib/event-presentation";
import type { GameDetails } from "@/lib/live-data";
import { SPORTS } from "@/lib/live-data";
import { canDisplayScore, displayScoreValue, scoreSeparator } from "@/lib/score-integrity";
import styles from "./game-center.module.css";

function sportName(id: GameDetails["event"]["sportId"]) { return SPORTS.find((sport) => sport.id === id)?.name || id; }
function date(value: string | null) { if (!value) return null; const d = new Date(value); return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(d); }
function phase(event: GameDetails["event"]) { return event.state === "in" ? "AO VIVO" : event.state === "post" ? "ENCERRADO" : event.state === "pre" ? "EM BREVE" : event.status; }

export function CleanGameCenter({ initialDetails, worldCup }: { initialDetails: GameDetails; worldCup: boolean }) {
  const [details, setDetails] = useState(initialDetails);
  const event = details.event;
  const eventUrl = `/jogos/${event.sportId}/${event.id}${worldCup ? "?torneio=copa-2026" : ""}`;
  const showScore = canDisplayScore(event);
  const eventDate = date(event.startTime);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      const response = await fetch(`/api/games/${event.sportId}/${event.id}${worldCup ? "?torneio=copa-2026" : ""}`, { cache: "no-store" }).catch(() => null);
      if (response?.ok) setDetails(await response.json() as GameDetails);
    }, event.state === "in" ? 8000 : 30000);
    return () => window.clearInterval(timer);
  }, [event.id, event.sportId, event.state, worldCup]);

  const facts = [
    event.status ? { label: "Status", value: event.status } : null,
    event.startTime && eventDate ? { label: "Quando", value: eventDate } : null,
    event.venue ? { label: "Local", value: event.venue } : null,
    event.broadcast ? { label: "Transmissão", value: event.broadcast } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return <main><LapHeader activeSport={event.sportId} /><div className="shell game-page">
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><Link href={`/modalidades/${event.sportId}`}>{sportName(event.sportId)}</Link></nav>
    <section className="game-hero">
      <div className="game-hero__meta">{phase(event) ? <span className={event.state === "in" ? "live-label" : "status-label"}>{phase(event)}</span> : null}{event.round || event.league ? <span>{event.round || event.league.replace(/-/g, " ")}</span> : null}<FavoriteButton id={`event:${event.sportId}:${event.id}`} type="event" label={eventDisplayTitle(event)} href={eventUrl} /></div>
      {event.league ? <p className="game-hero__competition">{worldCup ? "Copa do Mundo 2026" : event.league.replace(/-/g, " ")}</p> : null}
      {isSingleEvent(event) ? <div className={styles.singleEventHero}>{event.home.logo ? <img src={event.home.logo} alt="" width="82" height="82" /> : null}<div><p>{eventKindLabel(event.eventKind)}</p><h1>{event.home.name}</h1>{eventDate ? <span>{eventDate}</span> : null}</div></div> : <div className="scoreboard-hero"><article>{event.home.logo ? <img src={event.home.logo} alt="" width="72" height="72" /> : null}<h1>{event.home.name}</h1>{event.home.record ? <p>{event.home.record}</p> : null}</article><div className="scoreboard-hero__score"><strong>{showScore ? <>{displayScoreValue(event, "home")}<span>{scoreSeparator(event)}</span>{displayScoreValue(event, "away")}</> : <span>{scoreSeparator(event)}</span>}</strong>{eventDate ? <p>{eventDate}</p> : null}</div><article>{event.away.logo ? <img src={event.away.logo} alt="" width="72" height="72" /> : null}<h1>{event.away.name}</h1>{event.away.record ? <p>{event.away.record}</p> : null}</article></div>}
      {facts.length ? <section className="game-snapshot">{facts.map((fact) => <article key={fact.label}><p>{fact.label}</p><strong>{fact.value}</strong></article>)}<Link href="/agenda" className="game-snapshot__link">Ver agenda →</Link></section> : null}
    </section>

    {details.headlines.length || details.notes.length ? <section className="game-panel game-panel--summary"><div className={styles.summaryLead}><p>{sportName(event.sportId)}</p><h2>Resumo</h2></div>{details.headlines.length ? <div className={styles.focusBlock}><h3>Contexto</h3><ul>{details.headlines.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}{details.notes.length ? <div className={styles.infoBlock}><h3>Informações</h3><ul>{details.notes.map((item) => <li key={item}>{item}</li>)}</ul></div> : null}</section> : null}

    {details.teamStats.length ? <section className="game-panel"><div className={styles.panelHeader}><h2>Estatísticas</h2></div><div className="game-stats">{details.teamStats.map((team) => <article className="game-stats__team" key={team.team}><header>{team.logo ? <img src={team.logo} alt="" width="28" height="28" /> : null}<h3>{team.team}</h3></header><dl>{team.stats.filter((stat) => stat.value).map((stat) => <div key={`${team.team}-${stat.label}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></article>)}</div></section> : null}

    {details.lineups.some((lineup) => lineup.players.length) ? <section className="game-panel"><div className={styles.panelHeader}><h2>Escalações e participantes</h2></div><div className={styles.lineupsGrid}>{details.lineups.filter((lineup) => lineup.players.length).map((lineup) => <article className={styles.lineupCard} key={lineup.team}><header><h3>{lineup.team}</h3></header>{lineup.formation ? <div className={styles.formationBox}><strong>{lineup.formation}</strong></div> : null}<ol>{lineup.players.map((player) => <li key={`${lineup.team}-${player}`}>{player}</li>)}</ol></article>)}</div></section> : null}

    {details.timeline.length ? <section className="game-panel"><div className={styles.panelHeader}><h2>Linha do tempo</h2></div><ol className={styles.timelineList}>{details.timeline.map((item) => <li key={item.id}><div className={styles.timelineStamp}>{item.clock ? <strong>{item.clock}</strong> : null}{item.period ? <span>{item.period}</span> : null}</div><div className={styles.timelineBody}><p>{item.text}</p></div></li>)}</ol></section> : null}
  </div></main>;
}
