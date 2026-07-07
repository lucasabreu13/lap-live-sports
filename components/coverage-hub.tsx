"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { FavoriteButton } from "@/components/favorite-button";
import { FOOTBALL_COMPETITIONS, type FootballCoverage, type ScoreItem, type SportFeed } from "@/lib/live-data";

type FootballCoverageProps = {
  coverage: FootballCoverage;
  events: ScoreItem[];
};

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function eventMatchesCompetition(event: ScoreItem, competitionId: string) {
  if (competitionId === "all") return true;
  if (event.competitionId === competitionId) return true;
  const competition = FOOTBALL_COMPETITIONS.find((item) => item.id === competitionId);
  if (!competition) return false;
  const terms = [competition.name, competition.country, competition.espnPath.split("/").pop() || ""].map(normalize);
  const haystack = normalize(`${event.league} ${event.round || ""} ${event.country || ""}`);
  return terms.some((term) => term.length > 3 && haystack.includes(term));
}

export function FootballCoverageHub({ coverage, events }: FootballCoverageProps) {
  const [selected, setSelected] = useState("all");
  const visibleEvents = useMemo(() => events.filter((event) => eventMatchesCompetition(event, selected)).slice(0, 8), [events, selected]);
  const favorites = FOOTBALL_COMPETITIONS.slice(0, 8);

  return (
    <section className="football-coverage" id="futebol-global" aria-labelledby="futebol-global-title">
      <header className="football-coverage__header">
        <div>
          <p>Futebol sem fronteiras</p>
          <h2 id="futebol-global-title">Brasileirão, Europa, América e ligas do mundo</h2>
          <span>{coverage.competitions.length} competições mapeadas na central. Selecione uma liga para ver a agenda disponível.</span>
        </div>
        <Link href="/agenda" className="section-link">Abrir agenda completa</Link>
      </header>
      <div className="football-coverage__tools">
        <label>
          <span>Competição</span>
          <select value={selected} onChange={(event) => setSelected(event.target.value)}>
            <option value="all">Todas as ligas disponíveis</option>
            {coverage.competitions.map((competition) => <option key={competition.id} value={competition.id}>{competition.name} · {competition.country}</option>)}
          </select>
        </label>
        <p className={`football-coverage__source football-coverage__source--${coverage.sourceStatus}`}>{coverage.sourceStatus === "live" ? "Feed sincronizado" : coverage.sourceStatus === "stale" ? "Mostrando última resposta válida" : "Fonte em reconexão"}</p>
      </div>
      <div className="league-follow-grid" aria-label="Ligas para seguir">
        {favorites.map((competition) => (
          <article key={competition.id}>
            <div><small>{competition.country}</small><strong>{competition.name}</strong></div>
            <FavoriteButton id={`league:${competition.id}`} type="league" label={competition.name} href={`/campeonatos/${competition.id}`} />
          </article>
        ))}
      </div>
      {visibleEvents.length ? <div className="full-schedule__grid football-coverage__events">{visibleEvents.map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} showSport />)}</div> : <div className="empty-card football-coverage__empty">Não há partidas da liga escolhida neste recorte. Salve a competição para encontrá-la nos favoritos e acompanhe novas atualizações.</div>}
      {coverage.sourceNote && <p className="status-note">{coverage.sourceNote}</p>}
    </section>
  );
}

type PriorityRailProps = { feeds: SportFeed[] };

export function PrioritySportsRail({ feeds }: PriorityRailProps) {
  const priority = feeds.filter((feed) => feed.id === "futebol-americano" || feed.id === "formula1");
  return <section className="priority-rail" aria-label="Centrais prioritárias"><header><div><p>Grandes eventos</p><h2>NFL e Fórmula 1</h2></div><Link href="/agenda" className="section-link">Ver tudo</Link></header><div>{priority.map((feed) => <article key={feed.id}><div className="priority-rail__intro"><span>{feed.icon}</span><div><small>{feed.sourceStatus === "live" ? "Atualização ativa" : feed.sourceStatus === "stale" ? "Última atualização" : "Agenda em reconexão"}</small><h3>{feed.name}</h3><p>{feed.description || "Agenda, resultados e principais histórias em uma central própria."}</p></div></div><div className="priority-rail__events">{feed.scores.length ? feed.scores.slice(0, 2).map((event) => <EventCard key={event.id} score={event} compact />) : <div className="empty-card">A agenda oficial aparece aqui assim que a fonte publicar novos eventos.</div>}</div><Link href={`/modalidades/${feed.id}`} className="priority-rail__open">Abrir central {feed.name} →</Link></article>)}</div></section>;
}
