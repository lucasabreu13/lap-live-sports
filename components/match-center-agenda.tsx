"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { eventHref } from "@/lib/event-presentation";
import { readFavorites, subscribeFavorites, toggleFavorite, type FavoriteItem } from "@/lib/client-preferences";
import { FOOTBALL_COMPETITIONS, SPORTS, type LivePayload, type ScoreItem, type SportId } from "@/lib/live-data";
import styles from "./match-center-agenda.module.css";

type ViewMode = "timeline" | "calendar";
type StatusFilter = "all" | "live" | "upcoming" | "finished" | "favorites";
type DateFilter = "today" | "tomorrow" | "week" | "all";

const SNAPSHOT_KEY = "lap:live-snapshot:v1";

function key(event: ScoreItem) { return `${event.sportId}:${event.id}`; }
function eventFavoriteId(event: ScoreItem) { return `event:${event.sportId}:${event.id}`; }
function time(event: ScoreItem) { const value = new Date(event.startTime || 0).getTime(); return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER; }
function dayKey(value: string | null) { if (!value) return "unknown"; return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function todayKey(offset = 0) { const date = new Date(); date.setDate(date.getDate() + offset); return dayKey(date.toISOString()); }
function sportName(id: SportId) { return SPORTS.find((item) => item.id === id)?.name || id; }
function relativeStart(event: ScoreItem, now: number) {
  if (event.state === "in") return "AO VIVO";
  if (event.state === "post") return "Encerrado";
  if (!event.startTime) return null;
  const diff = time(event) - now;
  if (diff <= 0) return "Começando";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `Começa em ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Começa em ${hours}h${minutes % 60 ? ` ${minutes % 60}min` : ""}`;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(event.startTime));
}
function importance(event: ScoreItem, favorites: FavoriteItem[]) {
  const material = `${event.league} ${event.round || ""}`.toLowerCase();
  let score = event.state === "in" ? 100 : event.state === "pre" ? 30 : 0;
  if (favorites.some((item) => item.id === eventFavoriteId(event) || item.id === `sport:${event.sportId}` || item.id === `league:${event.competitionId}`)) score += 45;
  if (/final|playoff|championship|world series|super bowl|semifinal|quarterfinal|grand slam|masters/.test(material)) score += 35;
  if (/brasileir|libertadores|champions|premier|nba|nfl|formula|mlb|atp|wta/.test(material)) score += 12;
  return score;
}
function inRange(event: ScoreItem, filter: DateFilter) {
  if (filter === "all") return true;
  const eventDay = dayKey(event.startTime);
  if (filter === "today") return eventDay === todayKey();
  if (filter === "tomorrow") return eventDay === todayKey(1);
  const delta = time(event) - Date.now();
  return delta >= -24 * 60 * 60_000 && delta <= 7 * 24 * 60 * 60_000;
}

function AgendaCard({ event, now, favorite, onToggle }: { event: ScoreItem; now: number; favorite: boolean; onToggle: () => void }) {
  const startLabel = relativeStart(event, now);
  const detail = [event.venue, event.broadcast].filter(Boolean).join(" · ");
  return <article className={styles.card}>
    <div className={styles.cardTop}><span>{sportName(event.sportId)} · {event.league}</span><button type="button" onClick={onToggle} aria-label={favorite ? "Remover dos favoritos" : "Quero acompanhar"}>{favorite ? "★" : "☆"}</button></div>
    <Link href={eventHref(event)} className={styles.cardMain}>
      <strong>{event.home.name}{event.away.name ? ` × ${event.away.name}` : ""}</strong>
      {startLabel ? <span>{startLabel}</span> : null}
      {detail ? <small>{detail}</small> : null}
    </Link>
    <div className={styles.cardActions}><Link href={eventHref(event)}>Abrir Match Center →</Link>{event.startTime && <a href={`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${event.home.name} x ${event.away.name}`)}&dates=${new Date(event.startTime).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}/${new Date(time(event) + 2 * 60 * 60_000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`} target="_blank" rel="noreferrer">Adicionar ao calendário</a>}</div>
  </article>;
}

export function MatchCenterAgenda({ initialSport = "all", initialCompetition = "all", initialQuery = "", initialPayload = null }: { initialSport?: string; initialCompetition?: string; initialQuery?: string; initialPayload?: LivePayload | null }) {
  const [payload, setPayload] = useState<LivePayload | null>(initialPayload);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [date, setDate] = useState<DateFilter>("week");
  const [sport, setSport] = useState(initialSport);
  const [competition, setCompetition] = useState(initialCompetition);
  const [query, setQuery] = useState(initialQuery);
  const [view, setView] = useState<ViewMode>("timeline");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const sync = () => setFavorites(readFavorites()); sync();
    return subscribeFavorites(sync);
  }, []);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    let active = true;
    let timer = 0;
    if (!initialPayload) {
      try { const cached = JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null") as LivePayload | null; if (cached) setPayload(cached); } catch {}
    } else {
      try { localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(initialPayload)); } catch {}
    }
    const schedule = (next: LivePayload | null) => {
      const hasLive = Boolean(next?.feeds.some((feed) => feed.scores.some((event) => event.state === "in")));
      timer = window.setTimeout(load, hasLive ? 20_000 : 120_000);
    };
    const load = async () => {
      try {
        const response = await fetch("/api/live");
        if (!response.ok) { schedule(payload); return; }
        const data = await response.json() as LivePayload;
        if (active) { setPayload(data); localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(data)); schedule(data); }
      } catch { if (active) schedule(payload); }
    };
    if (initialPayload) schedule(initialPayload); else void load();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  const events = useMemo(() => {
    if (!payload) return [];
    return Array.from(new Map(payload.feeds.flatMap((feed) => feed.scores).map((event) => [key(event), event])).values());
  }, [payload]);
  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);
  const visible = useMemo(() => events.filter((event) => {
    const text = `${event.home.name} ${event.away.name} ${event.league} ${event.round || ""} ${event.country || ""}`.toLowerCase();
    const statusOk = status === "all" || (status === "live" && event.state === "in") || (status === "upcoming" && event.state === "pre") || (status === "finished" && event.state === "post") || (status === "favorites" && favoriteIds.has(eventFavoriteId(event)));
    const sportOk = sport === "all" || event.sportId === sport;
    const competitionOk = competition === "all" || event.competitionId === competition || event.league.toLowerCase().includes(competition.toLowerCase());
    return statusOk && sportOk && competitionOk && inRange(event, date) && (!query.trim() || text.includes(query.trim().toLowerCase()));
  }).sort((a, b) => importance(b, favorites) - importance(a, favorites) || time(a) - time(b)), [competition, date, events, favoriteIds, favorites, query, sport, status]);

  const live = visible.filter((event) => event.state === "in");
  const nextTwoHours = visible.filter((event) => event.state === "pre" && time(event) >= now && time(event) <= now + 2 * 60 * 60_000);
  const imperdiveis = visible.filter((event) => dayKey(event.startTime) === todayKey()).slice(0, 6);
  const grouped = useMemo(() => {
    const map = new Map<string, ScoreItem[]>();
    visible.forEach((event) => { const day = dayKey(event.startTime); map.set(day, [...(map.get(day) || []), event]); });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [visible]);

  const toggle = (event: ScoreItem) => toggleFavorite({ id: eventFavoriteId(event), type: "event", label: `${event.home.name} x ${event.away.name}`, href: eventHref(event) });
  const clearFilters = () => { setStatus("all"); setDate("week"); setSport("all"); setCompetition("all"); setQuery(""); };

  return <main><LapHeader /><div className={`shell ${styles.page}`}>
    <header className={styles.hero}><div><p>Agenda LAP · Match Center</p><h1>O que vale a pena acompanhar agora.</h1><span>Eventos ao vivo, próximos destaques, favoritos, transmissão e acesso direto ao centro de cada jogo.</span></div><div className={styles.stats}><strong>{live.length}<small>ao vivo</small></strong><strong>{events.filter((e) => e.state === "pre").length}<small>próximos</small></strong><strong>{favorites.length}<small>favoritos</small></strong></div></header>

    <section className={styles.quickFilters}><button className={date === "today" ? styles.active : ""} onClick={() => setDate("today")}>Hoje</button><button className={date === "tomorrow" ? styles.active : ""} onClick={() => setDate("tomorrow")}>Amanhã</button><button className={status === "live" ? styles.active : ""} onClick={() => setStatus(status === "live" ? "all" : "live")}>Ao vivo</button><button className={status === "favorites" ? styles.active : ""} onClick={() => setStatus(status === "favorites" ? "all" : "favorites")}>Meus jogos</button><button className={view === "calendar" ? styles.active : ""} onClick={() => setView(view === "calendar" ? "timeline" : "calendar")}>{view === "calendar" ? "Ver timeline" : "Modo calendário"}</button></section>

    <section className={styles.controls}><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar time, atleta, liga ou competição"/><select value={sport} onChange={(e) => { setSport(e.target.value); if (e.target.value !== "futebol") setCompetition("all"); }}><option value="all">Todas as modalidades</option>{SPORTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={competition} onChange={(e) => setCompetition(e.target.value)}><option value="all">Todas as competições</option>{(payload?.football.competitions || FOOTBALL_COMPETITIONS).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select value={date} onChange={(e) => setDate(e.target.value as DateFilter)}><option value="today">Hoje</option><option value="tomorrow">Amanhã</option><option value="week">Próximos 7 dias</option><option value="all">Todas as datas</option></select></section>

    {imperdiveis.length > 0 && <section className={styles.section}><div className={styles.heading}><div><p>🔥 Destaques</p><h2>Imperdíveis de hoje</h2></div><span>Priorizados por relevância, horário e favoritos.</span></div><div className={styles.grid}>{imperdiveis.slice(0,3).map((event) => <AgendaCard key={key(event)} event={event} now={now} favorite={favoriteIds.has(eventFavoriteId(event))} onToggle={() => toggle(event)} />)}</div></section>}
    {live.length > 0 && <section className={styles.section}><div className={styles.heading}><div><p>Tempo real</p><h2>Em andamento</h2></div><span>{live.length} evento{live.length === 1 ? "" : "s"}</span></div><div className={styles.grid}>{live.map((event) => <EventCard key={key(event)} score={event} showSport />)}</div></section>}
    {nextTwoHours.length > 0 && <section className={styles.section}><div className={styles.heading}><div><p>Próxima janela</p><h2>Começam nas próximas 2 horas</h2></div></div><div className={styles.grid}>{nextTwoHours.map((event) => <AgendaCard key={key(event)} event={event} now={now} favorite={favoriteIds.has(eventFavoriteId(event))} onToggle={() => toggle(event)} />)}</div></section>}

    {view === "calendar" ? <section className={styles.calendar}>{grouped.map(([day, items]) => <article key={day}><strong>{day === todayKey() ? "Hoje" : day === todayKey(1) ? "Amanhã" : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(`${day}T12:00:00`))}</strong><span>{items.length} evento{items.length === 1 ? "" : "s"}</span><div>{items.slice(0,5).map((event) => <Link key={key(event)} href={eventHref(event)}>{event.home.name} {event.away.name ? `× ${event.away.name}` : ""}</Link>)}</div></article>)}</section> : <div className={styles.timeline}>{grouped.map(([day, items]) => <section className={styles.section} key={day}><div className={styles.heading}><div><p>Agenda por data</p><h2>{day === todayKey() ? "Hoje" : day === todayKey(1) ? "Amanhã" : new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${day}T12:00:00`))}</h2></div><span>{items.length} eventos</span></div><div className={styles.grid}>{items.map((event) => <AgendaCard key={key(event)} event={event} now={now} favorite={favoriteIds.has(eventFavoriteId(event))} onToggle={() => toggle(event)} />)}</div></section>)}</div>}

    {!payload && <div className={styles.empty}>Preparando o Match Center da LAP…</div>}{payload && !visible.length && <div className={styles.empty}><p>Nenhum evento encontrado com os filtros atuais.</p><button type="button" onClick={clearFilters}>Limpar filtros</button></div>}
  </div></main>;
}
