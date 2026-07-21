"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { StandingGroups } from "@/components/sport-hubs/standing-groups";
import type { ProLeagueHub, ProTeam } from "@/lib/rich-team-league-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./rich-team-league-center.module.css";

function TeamLogo({ team }: { team: ProTeam }) {
  return team.logo ? <img className={styles.logo} src={team.logo} alt={`Logo ${team.name}`} width={48} height={48} /> : <span className={styles.logoFallback}>{team.abbreviation || team.shortName.slice(0, 2)}</span>;
}

export function RichTeamLeagueCenter({ hub }: { hub: ProLeagueHub }) {
  const [query, setQuery] = useState("");
  const visual = sportCoverImage(hub.config.sportId);
  const filtered = useMemo(() => {
    const needle = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return needle ? hub.teams.filter((team) => `${team.name} ${team.shortName} ${team.location} ${team.abbreviation}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(needle)) : hub.teams;
  }, [hub.teams, query]);
  const events = [...hub.live, ...hub.upcoming, ...hub.recent].slice(0, 12);
  return <main><LapHeader activeSport={hub.config.sportId} compact /><div className={`shell ${styles.page}`}>
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><span>{hub.config.label}</span></nav>
    <section className={styles.hero}><img src={visual.image} alt={visual.alt} /><div className={styles.heroOverlay}><span>Central completa</span><h1>{hub.config.title}</h1><p>{hub.config.subtitle}</p><div className={styles.metrics}><article><strong>{hub.teams.length}</strong><span>franquias</span></article>{hub.live.length ? <article><strong>{hub.live.length}</strong><span>ao vivo</span></article> : null}{hub.upcoming.length ? <article><strong>{hub.upcoming.length}</strong><span>próximos</span></article> : null}{hub.news.length ? <article><strong>{hub.news.length}</strong><span>notícias</span></article> : null}</div></div></section>
    {hub.teams.length ? <section className={styles.section}><header className={styles.sectionHead}><div><span>Times</span><h2>Explore todas as equipes</h2><p>Clique para abrir elenco, idade, posição, campanha, notícias e calendário.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar time" /></header><div className={styles.teamGrid}>{filtered.map((team) => <Link key={team.id} href={`/times/${hub.config.id}/${team.id}`}><TeamLogo team={team} /><span><strong>{team.shortName}</strong>{team.location || team.abbreviation ? <small>{[team.location, team.abbreviation].filter(Boolean).join(" · ")}</small> : null}</span><b>→</b></Link>)}</div></section> : null}
    {events.length ? <section className={styles.section}><header className={styles.sectionHead}><div><span>Temporada</span><h2>Jogos e resultados</h2></div><Link href={`/agenda?sport=${hub.config.sportId}`}>Agenda completa</Link></header><div className={styles.eventGrid}>{events.map((event) => <EventCard key={event.id} score={event} compact />)}</div></section> : null}
    {hub.standings.length ? <section className={styles.section}><header className={styles.sectionHead}><div><span>Classificação</span><h2>Standings</h2></div></header><StandingGroups groups={hub.standings.slice(0, 10)} limit={32} /></section> : null}
    {hub.news.length ? <section className={styles.section}><header className={styles.sectionHead}><div><span>Notícias {hub.config.label}</span><h2>Últimas histórias</h2></div></header><div className={styles.newsGrid}>{hub.news.map((item) => <Link key={item.id} href={item.internalUrl}><img src={item.imageUrl || visual.image} alt={item.imageAlt || visual.alt} loading="lazy" />{item.source ? <span>{item.source}</span> : null}<strong>{item.title}</strong>{item.excerpt ? <small>{item.excerpt}</small> : null}</Link>)}</div></section> : null}
  </div></main>;
}
