"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { readFavorites, subscribeFavorites, type FavoriteItem } from "@/lib/client-preferences";
import { subscribeToLiveRefresh } from "@/lib/client-live-refresh";
import { FOOTBALL_COMPETITIONS, SPORTS, type LivePayload, type ScoreItem } from "@/lib/live-data";
import { canDisplayScore, displayScoreValue } from "@/lib/score-integrity";

type Filter = "all" | "live" | "next" | "finished";
type DateWindow = "all" | "today" | "tomorrow" | "week";

function scoreTime(score: ScoreItem) { return score.startTime ? new Date(score.startTime).getTime() : 0; }
function ordered(events: ScoreItem[]) {
  const live = events.filter((item) => item.state === "in");
  const next = events.filter((item) => item.state === "pre").sort((a, b) => scoreTime(a) - scoreTime(b));
  const finished = events.filter((item) => item.state === "post").sort((a, b) => scoreTime(b) - scoreTime(a));
  return { live, next, finished, all: [...live, ...next, ...finished] };
}

function eventMatchesFilter(score: ScoreItem, filter: Filter) {
  return filter === "all" || (filter === "live" && score.state === "in") || (filter === "next" && score.state === "pre") || (filter === "finished" && score.state === "post");
}

function eventMatchesWindow(score: ScoreItem, window: DateWindow) {
  if (window === "all" || !score.startTime) return true;
  const date = new Date(score.startTime);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = Math.round((targetStart - dayStart) / 86_400_000);
  return window === "today" ? diff === 0 : window === "tomorrow" ? diff === 1 : diff >= 0 && diff <= 7;
}

function eventMatchesCompetition(score: ScoreItem, competition: string) {
  if (competition === "all") return true;
  if (score.competitionId === competition) return true;
  const definition = FOOTBALL_COMPETITIONS.find((item) => item.id === competition);
  return definition ? `${score.league} ${score.round || ""}`.toLowerCase().includes(definition.name.toLowerCase()) : false;
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
        if (active) { setData(await response.json() as LivePayload); setError(false); }
      } catch { if (active) setError(true); }
    };
    void load();
    const unsubscribeRefresh = subscribeToLiveRefresh(load, { intervalMs: 12_000 });
    const source = "EventSource" in window ? new EventSource("/api/live/stream") : null;
    source?.addEventListener("snapshot", (event) => { try { if (active) setData(JSON.parse((event as MessageEvent<string>).data) as LivePayload); } catch { /* Próximo polling reconcilia */ } });
    source?.addEventListener("score", () => void load());
    return () => { active = false; unsubscribeRefresh(); source?.close(); };
  }, []);
  return { data, error };
}

function FilterControls({ filter, setFilter, events }: { filter: Filter; setFilter: (filter: Filter) => void; events: ScoreItem[] }) {
  const counts = ordered(events);
  return <div className="world-cup__filters" aria-label="Filtrar partidas"><button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos <span>{counts.all.length}</span></button><button className={filter === "live" ? "active" : ""} onClick={() => setFilter("live")}>Ao vivo <span>{counts.live.length}</span></button><button className={filter === "next" ? "active" : ""} onClick={() => setFilter("next")}>Próximos <span>{counts.next.length}</span></button><button className={filter === "finished" ? "active" : ""} onClick={() => setFilter("finished")}>Encerrados <span>{counts.finished.length}</span></button></div>;
}

export function WorldCupHub() {
  const { data, error } = useLiveFeed();
  const [filter, setFilter] = useState<Filter>("all");
  const [round, setRound] = useState("all");
  const events = data?.worldCup.events ?? [];
  const rounds = useMemo(() => Array.from(new Set(events.map((event) => event.round || "Partidas").filter(Boolean))), [events]);
  const brazil = useMemo(() => events.filter((event) => /brasil|brazil/i.test(`${event.home.name} ${event.away.name}`)), [events]);
  const visible = events.filter((event) => eventMatchesFilter(event, filter) && (round === "all" || (event.round || "Partidas") === round));
  const bracket = useMemo(() => rounds.map((name) => ({ name, events: events.filter((event) => (event.round || "Partidas") === name) })), [events, rounds]);

  return <main><LapHeader /><div className="shell page hub-page"><section className="hub-hero hub-hero--cup"><p>Especial LAP</p><h1>Copa do Mundo 2026</h1><span>Resultados, próximas partidas, central da Seleção e caminho da fase decisiva.</span><div className="hub-hero__stats"><strong>{ordered(events).live.length}<small>ao vivo</small></strong><strong>{ordered(events).next.length}<small>próximos</small></strong><strong>{ordered(events).finished.length}<small>encerrados</small></strong></div></section>
  <section className="cup-brazil"><div><p>Seleção Brasileira</p><h2>Brasil na Copa</h2><span>Agenda, resultados e acesso rápido a cada central de jogo.</span></div><div className="cup-brazil__games">{brazil.length ? brazil.slice(0, 3).map((event) => <EventCard key={event.id} score={event} cup />) : <p>A programação da Seleção aparece aqui assim que as partidas forem confirmadas.</p>}</div></section>
  <section className="hub-section"><header className="hub-section__heading"><div><p>Calendário completo</p><h2>Todos os jogos da Copa</h2></div><select value={round} onChange={(event) => setRound(event.target.value)} aria-label="Filtrar fase"><option value="all">Todas as fases</option>{rounds.map((item) => <option key={item} value={item}>{item}</option>)}</select></header><FilterControls filter={filter} setFilter={setFilter} events={events} />{visible.length ? <div className="full-schedule__grid">{visible.map((event) => <EventCard key={event.id} score={event} cup />)}</div> : <div className="empty-card">Nenhuma partida encontrada neste recorte.</div>}</section>
  <section className="hub-section"><header className="hub-section__heading"><div><p>Caminho da competição</p><h2>Chaveamento por fase</h2></div></header>{bracket.length ? <div className="bracket-grid">{bracket.map((group) => <article key={group.name} className="bracket-column"><h3>{group.name}</h3>{group.events.map((event) => <Link key={event.id} href={`/jogos/${event.sportId}/${event.id}?torneio=copa-2026`}><span>{event.home.name} {canDisplayScore(event) && <strong>{displayScoreValue(event, "home")}</strong>}</span><span>{event.away.name} {canDisplayScore(event) && <strong>{displayScoreValue(event, "away")}</strong>}</span></Link>)}</article>)}</div> : <div className="empty-card">O chaveamento aparece conforme as partidas forem registradas.</div>}</section>
  {error && <p className="status-note">A atualização mais recente não chegou. A LAP tenta novamente automaticamente.</p>}</div></main>;
}

export function ScheduleHub() {
  const { data, error } = useLiveFeed();
  const [filter, setFilter] = useState<Filter>("all");
  const [sport, setSport] = useState("all");
  const [window, setWindow] = useState<DateWindow>("week");
  const [competition, setCompetition] = useState("all");
  const [query, setQuery] = useState("");
  const events = useMemo(() => {
    const all = [...(data?.worldCup.events ?? []), ...(data?.feeds.flatMap((feed) => feed.scores) ?? [])];
    return Array.from(new Map(all.map((event) => [`${event.sportId}-${event.id}-${event.isWorldCup ? "cup" : "main"}`, event])).values());
  }, [data]);
  const visible = events.filter((event) => {
    const text = `${event.home.name} ${event.away.name} ${event.league} ${event.round || ""}`.toLowerCase();
    return eventMatchesFilter(event, filter) && eventMatchesWindow(event, window) && eventMatchesCompetition(event, competition) && (sport === "all" || event.sportId === sport) && (!query.trim() || text.includes(query.toLowerCase()));
  });
  return <main><LapHeader /><div className="shell page hub-page"><section className="hub-hero"><p>Agenda LAP</p><h1>Jogos, resultados e próximos eventos</h1><span>Filtre por data, esporte, liga e confronto. Nos próximos eventos, use o botão ＋ para salvar no Google Calendar.</span></section><section className="schedule-controls"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar time ou competição" /><select value={window} onChange={(event) => setWindow(event.target.value as DateWindow)}><option value="all">Todas as datas</option><option value="today">Hoje</option><option value="tomorrow">Amanhã</option><option value="week">Próximos 7 dias</option></select><select value={sport} onChange={(event) => { setSport(event.target.value); if (event.target.value !== "futebol") setCompetition("all"); }}><option value="all">Todas as modalidades</option>{SPORTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={competition} onChange={(event) => { setCompetition(event.target.value); setSport(event.target.value === "all" ? sport : "futebol"); }}><option value="all">Todas as ligas de futebol</option>{(data?.football.competitions ?? FOOTBALL_COMPETITIONS).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.country}</option>)}</select></section><FilterControls filter={filter} setFilter={setFilter} events={events} />{visible.length ? <div className="full-schedule__grid">{ordered(visible).all.map((event) => <EventCard key={`${event.sportId}-${event.id}-${event.isWorldCup ? "cup" : "main"}`} score={event} showSport />)}</div> : <div className="empty-card">Nenhuma partida encontrada neste recorte. Troque a data, liga ou modalidade para ampliar a busca.</div>}{error && <p className="status-note">A atualização mais recente não chegou. A LAP tenta novamente automaticamente.</p>}</div></main>;
}

export function FavoritesHub() {
  const { data } = useLiveFeed();
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  useEffect(() => { const sync = () => setFavorites(readFavorites()); sync(); return subscribeFavorites(sync); }, []);
  const favoriteEvents = useMemo(() => {
    const events = [...(data?.worldCup.events ?? []), ...(data?.feeds.flatMap((feed) => feed.scores) ?? [])];
    const ids = new Set(favorites.filter((item) => item.type === "event").map((item) => item.id));
    return events.filter((event) => ids.has(`event:${event.sportId}:${event.id}`));
  }, [data, favorites]);
  const favoriteSports = favorites.filter((item) => item.type === "sport");
  return <main><LapHeader /><div className="shell page hub-page"><section className="hub-hero"><p>Minha LAP</p><h1>Favoritos</h1><span>Seus clubes, partidas e modalidades ficam reunidos aqui neste dispositivo.</span></section><section className="hub-section"><header className="hub-section__heading"><div><p>Modalidades</p><h2>O que você acompanha</h2></div></header>{favoriteSports.length ? <div className="favorite-links">{favoriteSports.map((favorite) => <Link key={favorite.id} href={favorite.href}>{favorite.label}<span>→</span></Link>)}</div> : <div className="empty-card">Adicione uma modalidade usando a estrela na página de cobertura.</div>}</section><section className="hub-section"><header className="hub-section__heading"><div><p>Competições</p><h2>Ligas que você segue</h2></div></header>{favorites.filter((item) => item.type === "league").length ? <div className="favorite-links">{favorites.filter((item) => item.type === "league").map((favorite) => <Link key={favorite.id} href={favorite.href}>{favorite.label}<span>→</span></Link>)}</div> : <div className="empty-card">Salve Brasileirão, Champions, Premier League e outras ligas na central de futebol mundial.</div>}</section><section className="hub-section"><header className="hub-section__heading"><div><p>Partidas</p><h2>Jogos salvos</h2></div></header>{favoriteEvents.length ? <div className="full-schedule__grid">{favoriteEvents.map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} />)}</div> : <div className="empty-card">Adicione uma partida usando a estrela no card ou na central de jogo.</div>}</section></div></main>;
}
