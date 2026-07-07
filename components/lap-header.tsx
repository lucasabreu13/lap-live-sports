"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { readNotificationPreferences, writeNotificationPreferences } from "@/lib/client-preferences";
import { FOOTBALL_COMPETITIONS, SPORTS, type LivePayload, type SportId } from "@/lib/live-data";
import { eventHref } from "@/components/event-card";

type LapHeaderProps = {
  activeSport?: SportId | "todos";
  onRefresh?: () => void;
  isRefreshing?: boolean;
  compact?: boolean;
};

type SearchResult = { id: string; title: string; meta: string; href: string; kind: "matéria" | "jogo" | "modalidade" | "liga" };

function buildSearchResults(payload: LivePayload | null, query: string): SearchResult[] {
  if (!payload || query.trim().length < 2) return [];
  const normalized = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(normalized);
  const sportMatches = SPORTS.filter((sport) => matches(sport.name)).map((sport) => ({ id: `sport-${sport.id}`, title: sport.name, meta: "Modalidade", href: `/modalidades/${sport.id}`, kind: "modalidade" as const }));
  const leagueMatches = FOOTBALL_COMPETITIONS.filter((competition) => matches(competition.name) || matches(competition.country)).slice(0, 5)
    .map((competition) => ({ id: `league-${competition.id}`, title: competition.name, meta: `Liga · ${competition.country}`, href: `/campeonatos/${competition.id}`, kind: "liga" as const }));
  const articleMatches = [...payload.editorial, ...payload.feeds.flatMap((feed) => feed.news)]
    .filter((item) => matches(item.title) || matches(item.excerpt) || matches(item.source))
    .slice(0, 6)
    .map((item) => ({ id: `article-${item.id}`, title: item.title, meta: `${item.sportId} · ${item.source}`, href: item.internalUrl, kind: "matéria" as const }));
  const scoreMatches = [...payload.worldCup.events, ...payload.feeds.flatMap((feed) => feed.scores)]
    .filter((score) => matches(score.home.name) || matches(score.away.name) || matches(score.league) || matches(score.round || ""))
    .slice(0, 6)
    .map((score) => ({ id: `score-${score.sportId}-${score.id}`, title: `${score.home.name} × ${score.away.name}`, meta: `${score.league.replace(/-/g, " ")} · ${score.status}`, href: eventHref(score), kind: "jogo" as const }));
  return [...sportMatches, ...leagueMatches, ...scoreMatches, ...articleMatches].slice(0, 10);
}

function NotificationControl() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported("Notification" in window);
    setEnabled(readNotificationPreferences().enabled && Notification.permission === "granted");
  }, []);

  async function toggleAlerts() {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }
    const next = !enabled;
    writeNotificationPreferences({ enabled: next, favoriteOnly: true });
    setEnabled(next);
  }

  if (!supported) return null;
  return <button type="button" className={`header-icon-button ${enabled ? "header-icon-button--active" : ""}`} onClick={() => void toggleAlerts()} title={enabled ? "Desativar alertas" : "Ativar alertas para favoritos"} aria-pressed={enabled}>{enabled ? "🔔" : "🔕"}</button>;
}

function InstallControl() {
  const [promptEvent, setPromptEvent] = useState<Event | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const listener = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };
    window.addEventListener("beforeinstallprompt", listener);
    window.addEventListener("appinstalled", onInstalled);
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .then((registration) => void registration.update())
        .catch(() => undefined);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", listener);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    const event = promptEvent as (Event & { prompt?: () => Promise<void>; userChoice?: Promise<{ outcome: string }> }) | null;
    if (!event?.prompt) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice?.outcome === "accepted") setPromptEvent(null);
  }

  if (installed || !promptEvent) return null;
  return <button type="button" className="header-install" onClick={() => void install()}>Instalar</button>;
}

function SearchBox() {
  const [query, setQuery] = useState("");
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch("/api/live", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        setPayload(await response.json() as LivePayload);
        setOpen(true);
      } catch {
        // A busca segue disponível na próxima tentativa sem interromper a navegação.
      } finally {
        setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const results = useMemo(() => buildSearchResults(payload, query), [payload, query]);

  return (
    <div className="site-search">
      <label className="sr-only" htmlFor="lap-search">Buscar na LAP</label>
      <input id="lap-search" value={query} onChange={(event) => setQuery(event.target.value)} onFocus={() => query.trim().length >= 2 && setOpen(true)} placeholder="Buscar time, atleta ou competição" autoComplete="off" />
      <span className="site-search__icon" aria-hidden>{loading ? "…" : "⌕"}</span>
      {open && (
        <div className="site-search__results" role="listbox" aria-label="Resultados da busca">
          {results.length ? results.map((result) => (
            <Link key={result.id} href={result.href} className="site-search__result" onClick={() => { setOpen(false); setQuery(""); }}>
              <span>{result.kind}</span>
              <strong>{result.title}</strong>
              <small>{result.meta}</small>
            </Link>
          )) : <p className="site-search__empty">Nenhum resultado encontrado agora.</p>}
        </div>
      )}
    </div>
  );
}

export function LapHeader({ activeSport = "todos", onRefresh, isRefreshing = false, compact = false }: LapHeaderProps) {
  return (
    <>
      {!compact && <div className="breaking-strip"><div className="shell breaking-strip__inside"><span className="pulse-dot" aria-hidden /><Link href="/copa-2026">Copa do Mundo 2026 em destaque na LAP</Link><Link className="breaking-strip__source" href="/copa-2026">Abrir central da Copa</Link></div></div>}
      <header className="masthead">
        <div className="shell masthead__inside">
          <Link className="brand" href="/" aria-label="LAP, início"><span className="brand__mark">LAP</span><span className="brand__tag">live sports</span></Link>
          <div className="masthead__tools">
            <SearchBox />
            <Link href="/favoritos" className="header-icon-button" title="Favoritos" aria-label="Abrir favoritos">★</Link>
            <NotificationControl />
            <InstallControl />
            {onRefresh && <button className="refresh-button" type="button" onClick={onRefresh} disabled={isRefreshing}><span aria-hidden>↻</span> {isRefreshing ? "Atualizando" : "Atualizar"}</button>}
          </div>
        </div>
      </header>
      <nav className="sport-nav" aria-label="Modalidades esportivas">
        <div className="shell sport-nav__inside">
          <Link href="/copa-2026" className="world-cup-nav">🏆 Copa 2026</Link>
          <Link href="/agenda" className="sport-nav__agenda">Agenda</Link>
          <Link href="/" className={activeSport === "todos" ? "active" : ""}>Todos</Link>
          {SPORTS.map((sport) => <Link href={`/modalidades/${sport.id}`} className={activeSport === sport.id ? "active" : ""} key={sport.id}>{sport.icon} {sport.name}</Link>)}
        </div>
      </nav>
    </>
  );
}

export function SportFavoriteButton({ sportId }: { sportId: SportId }) {
  const sport = SPORTS.find((item) => item.id === sportId);
  if (!sport) return null;
  return <FavoriteButton id={`sport:${sport.id}`} type="sport" label={sport.name} href={`/modalidades/${sport.id}`} className="sport-favorite-button" />;
}
