"use client";

import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { readFavorites, subscribeFavorites, type FavoriteItem } from "@/lib/client-preferences";
import { FOOTBALL_COMPETITIONS, SPORTS, type LivePayload, type ScoreItem, type SportId } from "@/lib/live-data";
import { getSportDataBlueprint } from "@/lib/sport-data-blueprints";
import styles from "./schedule-experience.module.css";

type StatusFilter = "all" | "live" | "next" | "finished";
type DateFilter = "all" | "today" | "tomorrow" | "week";
type PriorityFilter = "all" | "favorites";
type SportLike = { id: SportId; name: string; icon: string; description?: string };

function scoreTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;
  const value = new Date(score.startTime).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function eventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function localDate(value: string | null, offset = 0) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  if (!value && offset) date.setDate(date.getDate() + offset);
  return date;
}

function dateKey(value: string | null, offset = 0) {
  const date = localDate(value, offset);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dateLabel(value: string | null) {
  const key = dateKey(value);
  if (!key) return "Data a confirmar";
  if (key === dateKey(null)) return "Hoje";
  if (key === dateKey(null, 1)) return "Amanhã";
  const date = localDate(value);
  if (!date) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo" }).format(date);
}

function stateMatches(score: ScoreItem, filter: StatusFilter) {
  return filter === "all" || (filter === "live" && score.state === "in") || (filter === "next" && score.state === "pre") || (filter === "finished" && score.state === "post");
}

function dateMatches(score: ScoreItem, filter: DateFilter) {
  if (filter === "all") return true;
  if (filter === "today") return score.startTime ? dateKey(score.startTime) === dateKey(null) : false;
  if (filter === "tomorrow") return score.startTime ? dateKey(score.startTime) === dateKey(null, 1) : false;
  if (!score.startTime) return false;
  const start = new Date(score.startTime).getTime();
  const diff = start - Date.now();
  if (score.state === "post") return diff >= -3 * 24 * 60 * 60_000;
  return diff >= -12 * 60 * 60_000 && diff <= 7 * 24 * 60 * 60_000;
}

function competitionMatches(score: ScoreItem, competition: string) {
  if (competition === "all") return true;
  if (score.competitionId === competition) return true;
  const definition = FOOTBALL_COMPETITIONS.find((item) => item.id === competition);
  if (!definition) return false;
  const value = `${score.league} ${score.round || ""}`.toLocaleLowerCase("pt-BR");
  return value.includes(definition.name.toLocaleLowerCase("pt-BR"));
}

function isFavorite(score: ScoreItem, favorites: FavoriteItem[]) {
  const eventId = `event:${score.sportId}:${score.id}`;
  const sportId = `sport:${score.sportId}`;
  const leagueId = score.competitionId ? `league:${score.competitionId}` : "";
  return favorites.some((favorite) => favorite.id === eventId || favorite.id === sportId || (leagueId && favorite.id === leagueId));
}

function compareEvents(a: ScoreItem, b: ScoreItem, favorites: FavoriteItem[]) {
  const phase = (score: ScoreItem) => score.state === "in" ? 0 : score.state === "pre" ? 1 : 2;
  const phaseDiff = phase(a) - phase(b);
  if (phaseDiff) return phaseDiff;
  const favoriteDiff = Number(isFavorite(b, favorites)) - Number(isFavorite(a, favorites));
  if (favoriteDiff) return favoriteDiff;
  if (a.state === "post" && b.state === "post") return scoreTime(b) - scoreTime(a);
  return scoreTime(a) - scoreTime(b);
}

function sportMeta(sportId: SportId) {
  return SPORTS.find((item) => item.id === sportId) ?? { id: sportId, name: sportId, icon: "•" };
}

function groupBySport(events: ScoreItem[]) {
  const groups = new Map<SportId, ScoreItem[]>();
  for (const event of events) groups.set(event.sportId, [...(groups.get(event.sportId) ?? []), event]);
  return [...groups.entries()].map(([sportId, items]) => ({ sport: sportMeta(sportId), events: items }));
}

function groupByDateAndSport(events: ScoreItem[]) {
  const byDate = new Map<string, ScoreItem[]>();
  for (const event of events) {
    const key = event.startTime ? dateKey(event.startTime) : "sem-data";
    byDate.set(key, [...(byDate.get(key) ?? []), event]);
  }
  return [...byDate.entries()]
    .sort(([aKey, aEvents], [bKey, bEvents]) => {
      if (aKey === "sem-data") return 1;
      if (bKey === "sem-data") return -1;
      const aTime = scoreTime(aEvents[0]);
      const bTime = scoreTime(bEvents[0]);
      return aTime - bTime;
    })
    .map(([key, items]) => ({ key, label: key === "sem-data" ? "Data a confirmar" : dateLabel(items[0]?.startTime ?? null), sportGroups: groupBySport(items) }));
}

function useLiveFeed() {
  const [data, setData] = useState<LivePayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/live", { cache: "no-store" });
        if (!response.ok) throw new Error("feed unavailable");
        if (active) {
          setData(await response.json() as LivePayload);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 30_000);
    const source = "EventSource" in window ? new EventSource("/api/live/stream") : null;
    source?.addEventListener("snapshot", (event) => {
      try {
        if (active) setData(JSON.parse((event as MessageEvent<string>).data) as LivePayload);
      } catch { /* O próximo polling reconcilia os dados. */ }
    });
    source?.addEventListener("score", () => void load());
    return () => {
      active = false;
      window.clearInterval(interval);
      source?.close();
    };
  }, []);

  return { data, error };
}

function SportRail({ events, selectedSport, onSelectSport }: { events: ScoreItem[]; selectedSport: string; onSelectSport: (sportId: string) => void }) {
  const rows = SPORTS.map((sport) => ({ sport, count: events.filter((event) => event.sportId === sport.id).length })).filter((row) => row.count > 0);
  if (!rows.length) return null;
  return (
    <section className={styles.sportRail} aria-label="Grade por modalidade">
      <div><p>Grade por esporte</p><h2>Escolha a modalidade</h2></div>
      <div className={styles.sportRailScroller}>
        <button type="button" className={selectedSport === "all" ? styles.activePill : ""} onClick={() => onSelectSport("all")}>Todos <span>{events.length}</span></button>
        {rows.map(({ sport, count }) => <button key={sport.id} type="button" className={selectedSport === sport.id ? styles.activePill : ""} onClick={() => onSelectSport(sport.id)}>{sport.icon} {sport.name}<span>{count}</span></button>)}
      </div>
    </section>
  );
}

function SportSurface({ sport }: { sport: SportLike | null }) {
  if (!sport) return null;
  const blueprint = getSportDataBlueprint(sport.id);
  if (!blueprint) return null;
  return (
    <section className={styles.surfaceCard} aria-label={`Formato de agenda de ${sport.name}`}>
      <div><p>{sport.icon} Formato da modalidade</p><h2>{sport.name}</h2><span>{sport.description || "Cobertura dedicada da LAP."}</span></div>
      <dl>
        <div><dt>Agenda ideal</dt><dd>{blueprint.primarySurface}</dd></div>
        <div><dt>Ao vivo</dt><dd>{blueprint.liveSurface}</dd></div>
        <div><dt>Participantes</dt><dd>{blueprint.rosterSurface}</dd></div>
      </dl>
    </section>
  );
}

function MiniEventList({ title, description, events }: { title: string; description: string; events: ScoreItem[] }) {
  if (!events.length) return null;
  return (
    <section className={styles.miniGroup}>
      <header><div><p>{description}</p><h2>{title}</h2></div><span>{events.length}</span></header>
      <div className={styles.eventGrid}>{events.map((event) => <EventCard key={eventKey(event)} score={event} showSport />)}</div>
    </section>
  );
}

function DateCluster({ label, sportGroups }: { label: string; sportGroups: Array<{ sport: SportLike; events: ScoreItem[] }> }) {
  return (
    <section className={styles.dateCluster}>
      <header><div><p>Agenda por data</p><h2>{label}</h2></div><span>{sportGroups.reduce((total, group) => total + group.events.length, 0)}</span></header>
      <div className={styles.dateSportGroups}>
        {sportGroups.map(({ sport, events }) => (
          <section className={styles.sportDateGroup} key={`${label}-${sport.id}`}>
            <div className={styles.sportDateHeader}><strong>{sport.icon} {sport.name}</strong><span>{events.length}</span></div>
            <div className={styles.eventGrid}>{events.map((event) => <EventCard key={eventKey(event)} score={event} showSport />)}</div>
          </section>
        ))}
      </div>
    </section>
  );
}

type ScheduleExperienceProps = {
  initialCompetition?: string;
  initialQuery?: string;
  initialSport?: string;
};

export function ScheduleExperience({
  initialCompetition = "all",
  initialQuery = "",
  initialSport = "all",
}: ScheduleExperienceProps) {
  const { data, error } = useLiveFeed();
  const isLoading = data === null && !error;
  const [status, setStatus] = useState<StatusFilter>("all");
  const [date, setDate] = useState<DateFilter>("week");
  const [sport, setSport] = useState(initialSport);
  const [competition, setCompetition] = useState(initialCompetition);
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [query, setQuery] = useState(initialQuery);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    sync();
    return subscribeFavorites(sync);
  }, []);

  const events = useMemo(() => {
    const all = [...(data?.worldCup.events ?? []), ...(data?.feeds.flatMap((feed) => feed.scores) ?? [])];
    return Array.from(new Map(all.map((event) => [eventKey(event), event])).values());
  }, [data]);

  const counts = useMemo(() => ({
    all: events.length,
    live: events.filter((event) => event.state === "in").length,
    next: events.filter((event) => event.state === "pre").length,
    finished: events.filter((event) => event.state === "post").length,
    favorites: events.filter((event) => isFavorite(event, favorites)).length,
  }), [events, favorites]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    return events
      .filter((event) => {
        const searchable = [event.home.name, event.away.name, event.league, event.round || "", event.country || ""].join(" ").toLocaleLowerCase("pt-BR");
        return stateMatches(event, status) && dateMatches(event, date) && competitionMatches(event, competition) && (sport === "all" || event.sportId === sport) && (priority === "all" || isFavorite(event, favorites)) && (!term || searchable.includes(term));
      })
      .sort((a, b) => compareEvents(a, b, favorites));
  }, [competition, date, events, favorites, priority, query, sport, status]);

  const selectedSport = sport === "all" ? null : sportMeta(sport as SportId);
  const liveEvents = useMemo(() => visible.filter((event) => event.state === "in"), [visible]);
  const scheduledEvents = useMemo(() => visible.filter((event) => event.state !== "in"), [visible]);
  const dateClusters = useMemo(() => groupByDateAndSport(scheduledEvents), [scheduledEvents]);
  const activeLabel = status === "live" ? "Ao vivo" : status === "next" ? "Próximos" : status === "finished" ? "Resultados" : "Todos os eventos";

  return (
    <main>
      <LapHeader />
      <div className="shell page hub-page">
        <section className="agenda-hero">
          <div>
            <p>Agenda LAP</p>
            <h1>Calendário esportivo por modalidade</h1>
            <span>Jogos, provas, cards, corridas, baterias e resultados organizados em uma única agenda.</span>
          </div>
          <div className="agenda-hero__stats" aria-label="Resumo da agenda">
            <strong>{counts.live}<small>ao vivo</small></strong>
            <strong>{counts.next}<small>próximos</small></strong>
            <strong>{counts.finished}<small>resultados</small></strong>
          </div>
        </section>

        <SportRail events={events} selectedSport={sport} onSelectSport={(sportId) => { setSport(sportId); if (sportId !== "futebol") setCompetition("all"); }} />
        <SportSurface sport={selectedSport} />

        <section className="agenda-controls" aria-label="Filtros da agenda">
          <label className="agenda-search"><span className="sr-only">Buscar time ou competição</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar time, atleta, liga ou competição" /></label>
          <select value={date} onChange={(event) => setDate(event.target.value as DateFilter)} aria-label="Período"><option value="all">Todas as datas</option><option value="today">Hoje</option><option value="tomorrow">Amanhã</option><option value="week">Próximos 7 dias</option></select>
          <select value={sport} onChange={(event) => { setSport(event.target.value); if (event.target.value !== "futebol") setCompetition("all"); }} aria-label="Modalidade"><option value="all">Todas as modalidades</option>{SPORTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <select value={competition} onChange={(event) => { const next = event.target.value; setCompetition(next); if (next !== "all") setSport("futebol"); }} aria-label="Competição"><option value="all">Todas as ligas de futebol</option>{(data?.football.competitions ?? FOOTBALL_COMPETITIONS).map((item) => <option key={item.id} value={item.id}>{item.name} - {item.country}</option>)}</select>
        </section>

        <div className="agenda-status-filters" role="tablist" aria-label="Status dos jogos">
          <button type="button" role="tab" aria-selected={status === "all"} className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>Todos <span>{counts.all}</span></button>
          <button type="button" role="tab" aria-selected={status === "live"} className={status === "live" ? "active" : ""} onClick={() => setStatus("live")}>Ao vivo <span>{counts.live}</span></button>
          <button type="button" role="tab" aria-selected={status === "next"} className={status === "next" ? "active" : ""} onClick={() => setStatus("next")}>Próximos <span>{counts.next}</span></button>
          <button type="button" role="tab" aria-selected={status === "finished"} className={status === "finished" ? "active" : ""} onClick={() => setStatus("finished")}>Resultados <span>{counts.finished}</span></button>
          <button type="button" role="tab" aria-selected={priority === "favorites"} className={priority === "favorites" ? "active" : ""} onClick={() => setPriority(priority === "favorites" ? "all" : "favorites")}>Favoritos <span>{counts.favorites}</span></button>
        </div>

        <p className="agenda-result-note" aria-live="polite">{visible.length} evento{visible.length === 1 ? "" : "s"} em {activeLabel.toLocaleLowerCase("pt-BR")}.{favorites.length ? " Seus favoritos recebem prioridade." : ""}</p>

        {isLoading ? (
          <section className="agenda-loading" aria-live="polite" aria-label="Carregando agenda"><div><p>Conectando ao radar</p><h2>Carregando os jogos da Agenda</h2><span>Buscando os eventos mais recentes.</span></div><div className="agenda-loading__grid" aria-hidden="true"><span /><span /><span /></div></section>
        ) : visible.length ? (
          <div className={styles.agendaStack}>
            <MiniEventList title="Ao vivo agora" description="Tempo real" events={liveEvents} />
            {dateClusters.map((cluster) => <DateCluster key={cluster.key} label={cluster.label} sportGroups={cluster.sportGroups} />)}
          </div>
        ) : (
          <section className="agenda-empty"><p>Nenhum evento encontrado neste recorte.</p><span>Troque a data, modalidade, liga ou termo de busca para ampliar a agenda.</span><button type="button" onClick={() => { setStatus("all"); setDate("week"); setSport("all"); setCompetition("all"); setPriority("all"); setQuery(""); }}>Limpar filtros</button></section>
        )}

        {error && <p className="status-note">Não foi possível atualizar a agenda agora. Tente novamente em instantes.</p>}
      </div>
    </main>
  );
}
