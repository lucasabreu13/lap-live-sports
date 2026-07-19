"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { LapHeader } from "@/components/lap-header";
import { readFavorites, subscribeFavorites, type FavoriteItem } from "@/lib/client-preferences";
import { subscribeToLiveRefresh } from "@/lib/client-live-refresh";
import { eventDisplayTitle, eventHref, eventPreLabel, isSingleEvent } from "@/lib/event-presentation";
import {
  FOOTBALL_COMPETITIONS,
  SPORTS,
  type GameDetails,
  type GameLineup,
  type GameLineupPlayer,
  type LivePayload,
  type ScoreItem,
  type SportId,
} from "@/lib/live-data";
import { canDisplayScore, displayScoreValue } from "@/lib/score-integrity";
import styles from "./live-scores-hub.module.css";

type LiveHubTab = "live" | "today" | "tomorrow" | "results";
type DetailTab = "summary" | "lineups" | "stats" | "events";
type FeedState = "loading" | "ready" | "error";
type DetailState = "idle" | "loading" | "refreshing" | "ready" | "error";

type SportDetailCopy = {
  lineups: string;
  lineupEmpty: string;
  events: string;
  guide: string;
  starterLimit: number | null;
};

const SPORT_DETAIL_COPY: Record<SportId, SportDetailCopy> = {
  futebol: { lineups: "Escalações", lineupEmpty: "As escalações oficiais ainda não foram divulgadas.", events: "Lances", guide: "Formação, titulares, banco, gols, cartões e estatísticas da partida.", starterLimit: 11 },
  "futebol-americano": { lineups: "Elencos", lineupEmpty: "Depth chart, titulares e inativos ainda não estão disponíveis.", events: "Drives", guide: "Placar por quarto, posse, drives, líderes e elencos disponíveis.", starterLimit: 11 },
  tenis: { lineups: "Atletas e chave", lineupEmpty: "Atletas, chave e ordem de jogo ainda não foram publicados.", events: "Sets e games", guide: "Sets, games, estatísticas dos atletas, chave e momentos decisivos.", starterLimit: 1 },
  ciclismo: { lineups: "Pelotão e equipes", lineupEmpty: "A lista de participantes ainda não foi publicada.", events: "Prova", guide: "Etapa, participantes, equipes, parciais e classificação disponível.", starterLimit: null },
  formula1: { lineups: "Grid e pilotos", lineupEmpty: "O grid e a lista desta sessão ainda não foram publicados.", events: "Voltas e incidentes", guide: "Sessão, grid, pilotos, voltas, pit stops e classificação disponível.", starterLimit: 20 },
  basquete: { lineups: "Quintetos e banco", lineupEmpty: "Quintetos, banco e rotação ainda não estão disponíveis.", events: "Jogadas e quartos", guide: "Placar por quarto, quintetos, banco e estatísticas do jogo.", starterLimit: 5 },
  beisebol: { lineups: "Lineup e arremessadores", lineupEmpty: "Batting order, pitchers e banco ainda não foram publicados.", events: "Innings e jogadas", guide: "Innings, lineup, arremessadores, rebatidas e estatísticas.", starterLimit: 9 },
  softball: { lineups: "Lineup e banco", lineupEmpty: "Lineup, pitchers e banco ainda não foram publicados.", events: "Innings e jogadas", guide: "Innings, lineup, pitchers e estatísticas disponíveis.", starterLimit: 9 },
  volei: { lineups: "Titulares e rotação", lineupEmpty: "Titulares, banco e rotação ainda não estão disponíveis.", events: "Sets e pontos", guide: "Parciais por set, rotação, atletas e pontos decisivos.", starterLimit: 6 },
  rugby: { lineups: "XV inicial e banco", lineupEmpty: "O XV inicial e os reservas ainda não foram divulgados.", events: "Lances", guide: "Tries, conversões, cartões, escalações e estatísticas.", starterLimit: 15 },
  criquete: { lineups: "XI e batting order", lineupEmpty: "O XI, a ordem de rebatida e os reservas ainda não foram publicados.", events: "Overs e wickets", guide: "Innings, overs, wickets, escalações e scorecard disponível.", starterLimit: 11 },
  mma: { lineups: "Card e corners", lineupEmpty: "O card detalhado e os corners ainda não estão disponíveis.", events: "Rounds", guide: "Card, categoria, rounds, método e estatísticas da luta.", starterLimit: 2 },
  golfe: { lineups: "Leaderboard e grupos", lineupEmpty: "Leaderboard, grupos e tee times ainda não estão disponíveis.", events: "Rodada e buracos", guide: "Leaderboard, rodada, grupos, tee times e desempenho por buraco.", starterLimit: null },
  natacao: { lineups: "Séries e raias", lineupEmpty: "Séries, raias e participantes ainda não foram publicados.", events: "Parciais", guide: "Prova, séries, raias, parciais e resultados disponíveis.", starterLimit: null },
  atletismo: { lineups: "Séries e participantes", lineupEmpty: "Séries, baterias e participantes ainda não foram publicados.", events: "Marcas e parciais", guide: "Prova, séries, tentativas, marcas e resultados disponíveis.", starterLimit: null },
  surfe: { lineups: "Baterias e surfistas", lineupEmpty: "As baterias e os surfistas ainda não foram publicados.", events: "Ondas e notas", guide: "Bateria, janela, ondas, notas e classificação disponível.", starterLimit: null },
};

function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function scoreKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function eventTime(score: ScoreItem) {
  const value = score.startTime ? new Date(score.startTime).getTime() : Number.NaN;
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function dateDiffFromToday(value: string | null, now: number) {
  if (!value || !now) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const today = new Date(`${formatter.format(new Date(now))}T00:00:00-03:00`).getTime();
  const eventDate = new Date(`${formatter.format(date)}T00:00:00-03:00`).getTime();
  return Math.round((eventDate - today) / 86_400_000);
}

function matchesFavorite(score: ScoreItem, favorites: FavoriteItem[]) {
  return favorites.some((item) => {
    if (item.id === `event:${score.sportId}:${score.id}` || item.id === `sport:${score.sportId}`) return true;
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
    const favoriteDelta = Number(matchesFavorite(b, favorites)) - Number(matchesFavorite(a, favorites));
    if (favoriteDelta) return favoriteDelta;
    const weight = (score: ScoreItem) => score.state === "in" ? 0 : score.state === "pre" ? 1 : 2;
    const stateDelta = weight(a) - weight(b);
    if (stateDelta) return stateDelta;
    return a.state === "post" || b.state === "post" ? eventTime(b) - eventTime(a) : eventTime(a) - eventTime(b);
  });
}

function phase(score: ScoreItem) {
  if (score.state === "in") return score.status || "AO VIVO";
  if (score.state === "post") return score.status || "ENCERRADO";
  if (score.state === "pre") return eventPreLabel(score);
  return score.status;
}

function formattedDate(value: string | null) {
  if (!value) return "Horário a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário a confirmar";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(date);
}

function updatedAgo(generatedAt: string | undefined, now: number) {
  if (!generatedAt || !now) return "conectando";
  const seconds = Math.max(0, Math.floor((now - new Date(generatedAt).getTime()) / 1000));
  if (seconds < 60) return `há ${seconds} segundo${seconds === 1 ? "" : "s"}`;
  return `há ${Math.floor(seconds / 60)} min`;
}

function initials(name: string) {
  const words = name.split(/\s+/).filter(Boolean).filter((word) => !["de", "da", "do", "dos", "fc", "cf"].includes(word.toLowerCase()));
  return (words.length ? words : [name]).slice(0, 2).map((word) => word[0]?.toUpperCase()).join("") || "LAP";
}

function TeamLogo({ logo, name, large = false }: { logo?: string | null; name: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={large ? styles.logoLarge : styles.logoSmall} aria-hidden="true">
      {logo && !failed
        ? <img src={logo} alt="" width={large ? 72 : 36} height={large ? 72 : 36} onError={() => setFailed(true)} />
        : <strong>{initials(name)}</strong>}
    </span>
  );
}

function useLiveHubFeed() {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [state, setState] = useState<FeedState>("loading");

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`/api/live?ts=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("unavailable");
        if (active) {
          setPayload(await response.json() as LivePayload);
          setState("ready");
        }
      } catch {
        if (active) setState((current) => current === "loading" ? "error" : current);
      }
    };
    void load();
    const unsubscribe = subscribeToLiveRefresh(load, { intervalMs: 8_000 });
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
      unsubscribe();
      source?.close();
    };
  }, []);

  return { payload, state };
}

function EventRow({ score, selected, onSelect }: { score: ScoreItem; selected: boolean; onSelect: () => void }) {
  const single = isSingleEvent(score);
  const showScore = canDisplayScore(score);
  return (
    <article className={`${styles.eventRow} ${selected ? styles.eventRowSelected : ""} ${score.state === "in" ? styles.eventRowLive : ""}`}>
      <button type="button" onClick={onSelect} aria-pressed={selected} aria-label={`Ver detalhes de ${eventDisplayTitle(score)}`}>
        <span className={styles.eventStatus}>{phase(score)}</span>
        <div className={styles.eventTeams}>
          <div><TeamLogo logo={score.home.logo} name={score.home.name} /><strong>{score.home.name}</strong>{showScore && <b>{displayScoreValue(score, "home")}</b>}</div>
          {!single && <div><TeamLogo logo={score.away.logo} name={score.away.name} /><strong>{score.away.name}</strong>{showScore && <b>{displayScoreValue(score, "away")}</b>}</div>}
        </div>
        <span className={styles.eventMeta}>{score.broadcast || score.venue || formattedDate(score.startTime)}</span>
      </button>
      <div className={styles.eventActions}>
        <FavoriteButton id={`event:${score.sportId}:${score.id}`} type="event" label={eventDisplayTitle(score)} href={eventHref(score)} />
        <Link href={eventHref(score)} aria-label={`Abrir página completa de ${eventDisplayTitle(score)}`} title="Página completa">↗</Link>
      </div>
    </article>
  );
}

function lineupMembers(lineup: GameLineup, limit: number | null) {
  if (lineup.members?.length) {
    const hasStarterFlag = lineup.members.some((player) => player.starter !== null);
    if (hasStarterFlag) return {
      starters: lineup.members.filter((player) => player.starter === true),
      bench: lineup.members.filter((player) => player.starter !== true),
    };
  }
  const members = lineup.players.map((name): GameLineupPlayer => ({ id: null, name, jersey: null, position: null, starter: null, formationPlace: null, active: null }));
  if (!limit) return { starters: members, bench: [] };
  return { starters: members.slice(0, limit), bench: members.slice(limit) };
}

function PlayerList({ title, players }: { title: string; players: GameLineupPlayer[] }) {
  return (
    <section className={styles.playerList}>
      <h4>{title} <span>{players.length}</span></h4>
      {players.length ? <ol>{players.map((player) => (
        <li key={player.id || player.name}>
          <span>{player.jersey || "-"}</span>
          <strong>{player.name}</strong>
          {player.position && <small>{player.position}</small>}
        </li>
      ))}</ol> : <p>Ainda não informado.</p>}
    </section>
  );
}

function LineupsPanel({ details, copy }: { details: GameDetails | null; copy: SportDetailCopy }) {
  if (!details?.lineups.length) return <div className={styles.detailEmpty}><strong>{copy.lineups}</strong><p>{copy.lineupEmpty}</p><span>A LAP atualiza este bloco assim que a lista confiável chega.</span></div>;
  return (
    <div className={styles.lineupGrid}>
      {details.lineups.map((lineup) => {
        const { starters, bench } = lineupMembers(lineup, copy.starterLimit);
        return (
          <article className={styles.lineupCard} key={lineup.team}>
            <header>
              <TeamLogo logo={lineup.logo} name={lineup.team} />
              <div><span>Equipe</span><h3>{lineup.team}</h3></div>
              {lineup.formation && <b>{lineup.formation}</b>}
            </header>
            <div className={styles.lineupColumns}>
              <PlayerList title="Titulares / principais" players={starters} />
              <PlayerList title="Reservas / rotação" players={bench} />
            </div>
          </article>
        );
      })}
    </div>
  );
}

function StatsPanel({ details }: { details: GameDetails | null }) {
  if (!details?.teamStats.length) return <div className={styles.detailEmpty}><strong>Estatísticas</strong><p>Os números detalhados ainda não foram disponibilizados para este evento.</p><span>Somente estatísticas confirmadas são exibidas.</span></div>;
  return (
    <div className={styles.statsGrid}>
      {details.teamStats.map((team) => (
        <article key={team.team}>
          <header><TeamLogo logo={team.logo} name={team.team} /><h3>{team.team}</h3></header>
          <dl>{team.stats.map((stat) => <div key={`${team.team}-${stat.label}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl>
        </article>
      ))}
    </div>
  );
}

function EventsPanel({ details, copy }: { details: GameDetails | null; copy: SportDetailCopy }) {
  if (!details?.timeline.length) return <div className={styles.detailEmpty}><strong>{copy.events}</strong><p>Os eventos detalhados ainda não foram publicados.</p><span>O placar continua sendo atualizado enquanto os lances não chegam.</span></div>;
  return (
    <ol className={styles.timeline}>
      {details.timeline.map((item) => (
        <li key={item.id} className={item.scoring ? styles.scoringEvent : ""}>
          <div><strong>{item.clock || "•"}</strong><span>{item.period ? `Período ${item.period}` : "Atualização"}</span></div>
          <p>{item.text}</p>
          {item.homeScore !== null && item.awayScore !== null && <b>{item.homeScore} × {item.awayScore}</b>}
        </li>
      ))}
    </ol>
  );
}

function mergedDetailEvent(score: ScoreItem, details: GameDetails | null): ScoreItem {
  const detail = details?.event;
  if (!detail) return score;
  const trustDetailState = detail.state !== "unknown";
  return {
    ...score,
    ...detail,
    league: score.league || detail.league,
    round: detail.round || score.round,
    competitionId: detail.competitionId || score.competitionId,
    country: detail.country || score.country,
    state: trustDetailState ? detail.state : score.state,
    status: trustDetailState ? detail.status : score.status,
    startTime: detail.startTime || score.startTime,
    venue: detail.venue || score.venue,
    broadcast: detail.broadcast || score.broadcast,
    home: { ...score.home, ...detail.home, logo: detail.home.logo || score.home.logo, record: detail.home.record || score.home.record },
    away: { ...score.away, ...detail.away, logo: detail.away.logo || score.away.logo, record: detail.away.record || score.away.record },
  };
}

function MatchDetail({ score, details, state }: { score: ScoreItem; details: GameDetails | null; state: DetailState }) {
  const [tab, setTab] = useState<DetailTab>("summary");
  const event = mergedDetailEvent(score, details);
  const copy = SPORT_DETAIL_COPY[event.sportId];
  const single = isSingleEvent(event);
  const showScore = canDisplayScore(event);

  return (
    <section className={styles.detailPane} aria-label={`Detalhes de ${eventDisplayTitle(event)}`}>
      <header className={styles.detailHeader}>
        <div className={styles.detailCompetition}>
          <span className={event.state === "in" ? styles.livePill : styles.statusPill}>{phase(event)}</span>
          <div><strong>{event.league}</strong><small>{event.round || SPORTS.find((sport) => sport.id === event.sportId)?.name}</small></div>
          {state === "refreshing" && <em>Atualizando</em>}
        </div>
        <div className={single ? styles.singleScoreboard : styles.scoreboard}>
          <article><TeamLogo logo={event.home.logo} name={event.home.name} large /><h2>{event.home.name}</h2>{event.home.record && <span>{event.home.record}</span>}</article>
          {single ? <div className={styles.singleStatus}><strong>{phase(event)}</strong><span>{formattedDate(event.startTime)}</span></div> : (
            <div className={styles.scoreValue}>
              <strong>{showScore ? displayScoreValue(event, "home") : "-"}</strong>
              <span>{showScore ? "×" : "vs"}</span>
              <strong>{showScore ? displayScoreValue(event, "away") : "-"}</strong>
            </div>
          )}
          {!single && <article><TeamLogo logo={event.away.logo} name={event.away.name} large /><h2>{event.away.name}</h2>{event.away.record && <span>{event.away.record}</span>}</article>}
        </div>
        <div className={styles.factBar}>
          <span><small>Data e hora</small><strong>{formattedDate(event.startTime)}</strong></span>
          <span><small>Local</small><strong>{event.venue || "A confirmar"}</strong></span>
          <span><small>Onde assistir</small><strong>{event.broadcast || "Não confirmado"}</strong></span>
        </div>
      </header>

      <nav className={styles.detailTabs} aria-label="Conteúdo do evento">
        {([
          ["summary", "Resumo"],
          ["lineups", copy.lineups],
          ["stats", "Estatísticas"],
          ["events", copy.events],
        ] as Array<[DetailTab, string]>).map(([id, label]) => (
          <button type="button" key={id} className={tab === id ? styles.activeTab : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>

      <div className={styles.detailContent}>
        {state === "loading" && <div className={styles.detailLoading}><span /><span /><span /></div>}
        {state === "error" && !details && <div className={styles.detailEmpty}><strong>Detalhes temporariamente indisponíveis</strong><p>O placar e as informações principais continuam visíveis.</p></div>}
        {tab === "summary" && state !== "loading" && (
          <div className={styles.summaryPanel}>
            <section><span>Cobertura da modalidade</span><h3>{copy.guide}</h3></section>
            {details?.timeline.length ? <section><span>Eventos recentes</span><ol>{details.timeline.slice(0, 4).map((item) => <li key={item.id}><b>{item.clock || "•"}</b><p>{item.text}</p></li>)}</ol></section> : null}
            {details?.headlines.length ? <section><span>Contexto</span><ul>{details.headlines.map((headline) => <li key={headline}>{headline}</li>)}</ul></section> : null}
            {details?.notes.length ? <section><span>Informações do evento</span><ul>{details.notes.map((note) => <li key={note}>{note}</li>)}</ul></section> : null}
          </div>
        )}
        {tab === "lineups" && <LineupsPanel details={details} copy={copy} />}
        {tab === "stats" && <StatsPanel details={details} />}
        {tab === "events" && <EventsPanel details={details} copy={copy} />}
      </div>

      <footer className={styles.detailFooter}>
        <FavoriteButton id={`event:${event.sportId}:${event.id}`} type="event" label={eventDisplayTitle(event)} href={eventHref(event)} />
        <Link href={eventHref(event)}>Abrir página completa</Link>
      </footer>
    </section>
  );
}

export function LiveScoresHub() {
  const { payload, state } = useLiveHubFeed();
  const [tab, setTab] = useState<LiveHubTab>("live");
  const [sport, setSport] = useState<string>("all");
  const [league, setLeague] = useState("all");
  const [query, setQuery] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [now, setNow] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [details, setDetails] = useState<GameDetails | null>(null);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [detailState, setDetailState] = useState<DetailState>("idle");

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
    return Array.from(new Map(all.map((event) => [scoreKey(event), event])).values());
  }, [payload]);

  const counts = useMemo(() => ({
    live: events.filter((event) => event.state === "in").length,
    today: events.filter((event) => eventMatchesTab(event, "today", now)).length,
    tomorrow: events.filter((event) => eventMatchesTab(event, "tomorrow", now)).length,
    results: events.filter((event) => event.state === "post").length,
  }), [events, now]);

  const sportCounts = useMemo(() => new Map(SPORTS.map((item) => [item.id, events.filter((event) => event.sportId === item.id && eventMatchesTab(event, tab, now)).length])), [events, now, tab]);
  const leagueOptions = useMemo(() => {
    const fromEvents = events.filter((event) => sport === "all" || event.sportId === sport).map((event) => ({ id: event.competitionId || event.league, name: event.league }));
    const official = sport === "all" || sport === "futebol" ? FOOTBALL_COMPETITIONS.map((item) => ({ id: item.id, name: item.name })) : [];
    return Array.from(new Map([...official, ...fromEvents].map((item) => [item.id, item])).values());
  }, [events, sport]);

  const filtered = useMemo(() => {
    const needle = normalizeText(query.trim());
    return sortEvents(events.filter((event) => {
      if (!eventMatchesTab(event, tab, now)) return false;
      if (sport !== "all" && event.sportId !== sport) return false;
      if (league !== "all" && event.competitionId !== league && event.league !== league) return false;
      if (favoritesOnly && !matchesFavorite(event, favorites)) return false;
      return !needle || normalizeText(`${event.home.name} ${event.away.name} ${event.league} ${event.round || ""} ${event.country || ""}`).includes(needle);
    }), favorites);
  }, [events, favorites, favoritesOnly, league, now, query, sport, tab]);

  const visibleEvents = useMemo(() => {
    if (tab !== "live" || filtered.length) return filtered;
    return sortEvents(events.filter((event) => eventMatchesTab(event, "today", now) || event.state === "pre"), favorites).slice(0, 18);
  }, [events, favorites, filtered, now, tab]);

  useEffect(() => {
    if (!visibleEvents.length) {
      setSelectedKey(null);
      return;
    }
    if (!selectedKey || !visibleEvents.some((event) => scoreKey(event) === selectedKey)) setSelectedKey(scoreKey(visibleEvents[0]));
  }, [selectedKey, visibleEvents]);

  const selected = visibleEvents.find((event) => scoreKey(event) === selectedKey) ?? visibleEvents[0] ?? null;

  useEffect(() => {
    if (!selected) return;
    const key = scoreKey(selected);
    const controller = new AbortController();
    setDetailState(detailsKey === key ? "refreshing" : "loading");
    const suffix = selected.isWorldCup ? "?torneio=copa-2026" : "";
    fetch(`/api/games/${selected.sportId}/${selected.id}${suffix}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("details unavailable");
        return response.json() as Promise<GameDetails>;
      })
      .then((result) => {
        setDetails(result);
        setDetailsKey(key);
        setDetailState("ready");
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setDetailState("error");
      });
    return () => controller.abort();
  }, [selected?.id, selected?.sportId, selected?.isWorldCup, payload?.generatedAt]);

  const groups = useMemo(() => {
    const map = new Map<string, ScoreItem[]>();
    visibleEvents.forEach((event) => map.set(event.league || "Eventos", [...(map.get(event.league || "Eventos") ?? []), event]));
    return [...map.entries()];
  }, [visibleEvents]);

  return (
    <main>
      <LapHeader />
      <div className={`shell ${styles.page}`}>
        <section className={styles.hero}>
          <div><p>Central de partidas</p><h1>Ao Vivo</h1><span>Placar, escalações, estatísticas e cada detalhe do evento no mesmo lugar.</span></div>
          <aside><strong>{counts.live}</strong><span>eventos ao vivo</span><small>Atualizado {updatedAgo(payload?.generatedAt, now)}</small></aside>
        </section>

        {state === "error" && !payload && <p className={styles.warning}>Não foi possível carregar os eventos agora. A central tentará novamente automaticamente.</p>}

        <section className={styles.controls}>
          <div className={styles.primaryTabs} role="tablist" aria-label="Período dos eventos">
            {([
              ["live", "Ao vivo", counts.live],
              ["today", "Hoje", counts.today],
              ["tomorrow", "Amanhã", counts.tomorrow],
              ["results", "Resultados", counts.results],
            ] as Array<[LiveHubTab, string, number]>).map(([id, label, count]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? styles.activePrimaryTab : ""} onClick={() => setTab(id)}>{label}<span>{count}</span></button>
            ))}
          </div>
          <div className={styles.sportRail} aria-label="Modalidades">
            <button type="button" className={sport === "all" ? styles.activeSport : ""} onClick={() => { setSport("all"); setLeague("all"); }}><span>Todos</span><b>{counts[tab]}</b></button>
            {SPORTS.map((item) => <button type="button" key={item.id} className={sport === item.id ? styles.activeSport : ""} onClick={() => { setSport(item.id); setLeague("all"); }}><i aria-hidden>{item.icon}</i><span>{item.name}</span><b>{sportCounts.get(item.id) || 0}</b></button>)}
          </div>
          <div className={styles.filters}>
            <label><span>Campeonato</span><select value={league} onChange={(event) => setLeague(event.target.value)}><option value="all">Todos os campeonatos</option>{leagueOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label><span>Busca</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Time, atleta ou competição" /></label>
            <button type="button" className={favoritesOnly ? styles.activeFavorite : ""} onClick={() => setFavoritesOnly((current) => !current)} aria-pressed={favoritesOnly}>★ Favoritos</button>
          </div>
        </section>

        {tab === "live" && !filtered.length && visibleEvents.length > 0 && <p className={styles.notice}>Nenhum evento ao vivo agora. A LAP manteve a central preenchida com os próximos eventos relevantes.</p>}

        {state === "loading" && !payload ? <div className={styles.boardLoading}><span /><span /><span /></div> : (
          <section className={styles.workspace}>
            <div className={styles.eventsPane} aria-label="Lista de eventos">
              <header><div><p>Partidas e eventos</p><h2>{visibleEvents.length} na central</h2></div><span>{updatedAgo(payload?.generatedAt, now)}</span></header>
              {groups.length ? groups.map(([group, items]) => (
                <section className={styles.eventGroup} key={group}>
                  <header><h3>{group}</h3><span>{items.length}</span></header>
                  <div>{items.map((event) => <EventRow key={scoreKey(event)} score={event} selected={scoreKey(event) === selectedKey} onSelect={() => setSelectedKey(scoreKey(event))} />)}</div>
                </section>
              )) : <div className={styles.noEvents}><strong>Nenhum evento neste recorte.</strong><p>Troque os filtros ou consulte a agenda completa.</p><Link href="/agenda">Abrir agenda</Link></div>}
            </div>
            {selected ? <MatchDetail key={scoreKey(selected)} score={selected} details={detailsKey === scoreKey(selected) ? details : null} state={detailState} /> : null}
          </section>
        )}
      </div>
    </main>
  );
}
