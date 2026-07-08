"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { readFavorites, subscribeFavorites, type FavoriteItem } from "@/lib/client-preferences";
import { FOOTBALL_COMPETITIONS, SPORTS, type LivePayload, type ScoreItem } from "@/lib/live-data";

type LiveHubTab = "live" | "today" | "tomorrow" | "results";
type FeedState = "loading" | "ready" | "error";

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function eventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function eventTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;
  const value = new Date(score.startTime).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function dateDiffFromToday(value: string | null, now: number) {
  if (!value || now <= 0) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const todayKey = new Date(now).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const eventKeyValue = date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const today = new Date(`${todayKey}T00:00:00-03:00`).getTime();
  const eventDate = new Date(`${eventKeyValue}T00:00:00-03:00`).getTime();
  return Math.round((eventDate - today) / 86_400_000);
}

function updatedAgo(value: string | null | undefined, now: number) {
  if (!value || now <= 0) return "Atualização pendente";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Atualização pendente";
  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSeconds < 60) return `Atualizado há ${diffSeconds} segundo${diffSeconds === 1 ? "" : "s"}`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `Atualizado há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  return `Atualizado há ${hours} hora${hours === 1 ? "" : "s"}`;
}

function clock(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function matchesFavorite(score: ScoreItem, favorites: FavoriteItem[]) {
  return favorites.some((item) => {
    if (item.id === `event:${score.sportId}:${score.id}`) return true;
    if (item.id === `sport:${score.sportId}`) return true;
    if (score.competitionId && item.id === `league:${score.competitionId}`) return true;
    return item.type === "team" && normalizeText(`${score.home.name} ${score.away.name}`).includes(normalizeText(item.label));
  });
}

function eventMatchesTab(score: ScoreItem, tab: LiveHubTab, now: number) {
  if (tab === "live") return score.state === "in";
  if (tab === "results") return score.state === "post";
  const diff = dateDiffFromToday(score.startTime, now);
  if (tab === "today") return score.state === "in" || diff === 0;
  return diff === 1;
}

function sortEvents(events: ScoreItem[], favorites: FavoriteItem[]) {
  return [...events].sort((a, b) => {
    const favoriteWeight = Number(matchesFavorite(b, favorites)) - Number(matchesFavorite(a, favorites));
    if (favoriteWeight) return favoriteWeight;
    const stateWeight = (score: ScoreItem) => score.state === "in" ? 0 : score.state === "pre" ? 1 : 2;
    const stateDelta = stateWeight(a) - stateWeight(b);
    if (stateDelta) return stateDelta;
    if (a.state === "post" || b.state === "post") return eventTime(b) - eventTime(a);
    return eventTime(a) - eventTime(b);
  });
}

function groupByLeague(events: ScoreItem[]) {
  const groups = new Map<string, ScoreItem[]>();
  for (const event of events) {
    const key = event.league || event.round || "Eventos";
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([league, items]) => ({ league, items }));
}

function useLiveHubFeed() {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [state, setState] = useState<FeedState>("loading");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/live?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("live feed unavailable");
        if (active) {
          setPayload(await response.json() as LivePayload);
          setState("ready");
        }
      } catch {
        if (active) setState((current) => current === "loading" ? "error" : current);
      }
    };
    void load();
    const interval = window.setInterval(() => void load(), 15_000);
    const source = "EventSource" in window ? new EventSource("/api/live/stream") : null;
    source?.addEventListener("snapshot", (event) => {
      try {
        if (active) {
          setPayload(JSON.parse((event as MessageEvent<string>).data) as LivePayload);
          setState("ready");
        }
      } catch {
        void load();
      }
    });
    source?.addEventListener("score", () => void load());
    source?.addEventListener("error", () => setState((current) => current === "loading" ? "error" : current));
    return () => {
      active = false;
      window.clearInterval(interval);
      source?.close();
    };
  }, []);

  return { payload, state };
}

export function LiveScoresHub() {
  const { payload, state } = useLiveHubFeed();
  const [tab, setTab] = useState<LiveHubTab>("live");
  const [sport, setSport] = useState("all");
  const [league, setLeague] = useState("all");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    sync();
    return subscribeFavorites(sync);
  }, []);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const events = useMemo(() => {
    const all = [...(payload?.worldCup.events ?? []), ...(payload?.feeds.flatMap((feed) => feed.scores) ?? [])];
    return Array.from(new Map(all.map((event) => [eventKey(event), event])).values());
  }, [payload]);

  const counts = useMemo(() => ({
    live: events.filter((event) => event.state === "in").length,
    today: events.filter((event) => eventMatchesTab(event, "today", now)).length,
    tomorrow: events.filter((event) => eventMatchesTab(event, "tomorrow", now)).length,
    results: events.filter((event) => event.state === "post").length,
  }), [events, now]);

  const leagueOptions = useMemo(() => {
    const fromEvents = events
      .filter((event) => sport === "all" || event.sportId === sport)
      .map((event) => ({ id: event.competitionId || event.league, name: event.league }));
    const official = sport === "all" || sport === "futebol"
      ? FOOTBALL_COMPETITIONS.map((item) => ({ id: item.id, name: item.name }))
      : [];
    return Array.from(new Map([...official, ...fromEvents].map((item) => [item.id, item])).values());
  }, [events, sport]);

  const filtered = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());
    return sortEvents(events.filter((event) => {
      if (!eventMatchesTab(event, tab, now)) return false;
      if (sport !== "all" && event.sportId !== sport) return false;
      if (league !== "all" && event.competitionId !== league && event.league !== league) return false;
      if (favoritesOnly && !matchesFavorite(event, favorites)) return false;
      if (normalizedQuery) {
        const haystack = normalizeText(`${event.home.name} ${event.away.name} ${event.league} ${event.round || ""} ${event.country || ""} ${event.sportId}`);
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    }), favorites);
  }, [events, favorites, favoritesOnly, league, now, query, sport, tab]);

  const liveFallback = useMemo(() => {
    if (tab !== "live" || filtered.length) return filtered;
    const relevant = events.filter((event) => eventMatchesTab(event, "today", now) || event.state === "pre");
    return sortEvents(relevant, favorites).slice(0, 12);
  }, [events, favorites, filtered, now, tab]);

  const groups = groupByLeague(liveFallback);
  const updatedAt = clock(payload?.generatedAt);
  const localClock = now ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(now)) : "--:--:--";
  const sourceIssue = Boolean(state === "error" || payload?.feeds.some((feed) => feed.sourceStatus !== "live") || payload?.worldCup.sourceStatus !== "ok");

  return (
    <main>
      <LapHeader />
      <div className="shell live-hub-page">
        <section className="live-hub-hero" aria-labelledby="live-hub-title">
          <div>
            <p>Central operacional</p>
            <h1 id="live-hub-title">Ao Vivo</h1>
            <span>Placar, agenda do dia e resultados com integridade dos dados aplicada antes de renderizar qualquer placar.</span>
          </div>
          <aside aria-live="polite">
            <strong>{updatedAgo(payload?.generatedAt, now)}</strong>
            {updatedAt && <span>Última atualização {updatedAt}</span>}
            <small>Horário local {localClock}</small>
          </aside>
        </section>

        {sourceIssue && <p className="live-hub-warning">Atualização discreta: uma fonte está atrasada ou reconectando. A LAP mantém o último retorno válido sem zerar a central.</p>}
        {state === "loading" && <div className="agenda-loading"><p>Conectando</p><h2>Carregando eventos ao vivo</h2><span>A central preserva a interface enquanto busca a resposta mais recente.</span></div>}

        <section className="live-hub-controls" aria-label="Filtros da central ao vivo">
          <div className="live-hub-tabs" role="tablist" aria-label="Recorte dos eventos">
            <button type="button" role="tab" aria-selected={tab === "live"} className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>Ao vivo <span>{counts.live}</span></button>
            <button type="button" role="tab" aria-selected={tab === "today"} className={tab === "today" ? "active" : ""} onClick={() => setTab("today")}>Hoje <span>{counts.today}</span></button>
            <button type="button" role="tab" aria-selected={tab === "tomorrow"} className={tab === "tomorrow" ? "active" : ""} onClick={() => setTab("tomorrow")}>Amanhã <span>{counts.tomorrow}</span></button>
            <button type="button" role="tab" aria-selected={tab === "results"} className={tab === "results" ? "active" : ""} onClick={() => setTab("results")}>Resultados <span>{counts.results}</span></button>
          </div>

          <div className="live-hub-filters">
            <label>
              <span>Modalidade</span>
              <select value={sport} onChange={(event) => { setSport(event.target.value); setLeague("all"); }}>
                <option value="all">Todas</option>
                {SPORTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Campeonato</span>
              <select value={league} onChange={(event) => setLeague(event.target.value)}>
                <option value="all">Todos</option>
                {leagueOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>
              <span>Busca</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Time, competição ou país" />
            </label>
            <button type="button" className={favoritesOnly ? "active" : ""} onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}>Favoritos</button>
          </div>
        </section>

        {tab === "live" && !filtered.length && liveFallback.length > 0 && <p className="live-hub-notice">Nenhum jogo ao vivo neste momento. Mostrando próximos eventos relevantes do dia e da agenda mais próxima.</p>}

        <section className="live-hub-board" aria-label="Eventos agrupados por campeonato">
          {groups.length ? groups.map((group) => (
            <article key={group.league} className="live-hub-group">
              <header>
                <div>
                  <p>Campeonato</p>
                  <h2>{group.league}</h2>
                </div>
                <span>{group.items.length}</span>
              </header>
              <div>
                {group.items.map((event) => <EventCard key={eventKey(event)} score={event} compact showSport />)}
              </div>
            </article>
          )) : (
            <div className="empty-card live-hub-empty">
              <strong>A central está pronta.</strong>
              <span>Troque filtros ou abra a agenda completa enquanto a fonte publica novos eventos.</span>
              <Link href="/agenda">Ver agenda</Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
