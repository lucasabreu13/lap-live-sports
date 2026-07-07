"use client";

import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import {
  readFavorites,
  subscribeFavorites,
  type FavoriteItem,
} from "@/lib/client-preferences";
import {
  FOOTBALL_COMPETITIONS,
  SPORTS,
  type LivePayload,
  type ScoreItem,
} from "@/lib/live-data";

type StatusFilter = "all" | "live" | "next" | "finished";
type DateFilter = "all" | "today" | "tomorrow" | "week";

function scoreTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;

  const value = new Date(score.startTime).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function eventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function dateKey(value: string | null, offset = 0) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "";

  if (!value && offset) date.setDate(date.getDate() + offset);

  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function stateMatches(score: ScoreItem, filter: StatusFilter) {
  return (
    filter === "all" ||
    (filter === "live" && score.state === "in") ||
    (filter === "next" && score.state === "pre") ||
    (filter === "finished" && score.state === "post")
  );
}

function dateMatches(score: ScoreItem, filter: DateFilter) {
  if (filter === "all" || score.state === "post") return true;
  if (!score.startTime) return false;

  const key = dateKey(score.startTime);

  if (filter === "today") return key === dateKey(null);
  if (filter === "tomorrow") return key === dateKey(null, 1);

  const start = new Date(score.startTime).getTime();
  const diff = start - Date.now();

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

  return favorites.some((favorite) =>
    favorite.id === eventId ||
    favorite.id === sportId ||
    (leagueId && favorite.id === leagueId),
  );
}

function compareEvents(a: ScoreItem, b: ScoreItem, favorites: FavoriteItem[]) {
  const phase = (score: ScoreItem) =>
    score.state === "in" ? 0 : score.state === "pre" ? 1 : 2;

  const phaseDiff = phase(a) - phase(b);

  if (phaseDiff) return phaseDiff;

  const favoriteDiff = Number(isFavorite(b, favorites)) - Number(isFavorite(a, favorites));

  if (favoriteDiff) return favoriteDiff;

  if (a.state === "post" && b.state === "post") return scoreTime(b) - scoreTime(a);

  return scoreTime(a) - scoreTime(b);
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
      } catch {
        // O proximo polling reconcilia os dados.
      }
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

function ScheduleGroup({
  title,
  description,
  events,
}: {
  title: string;
  description: string;
  events: ScoreItem[];
}) {
  if (!events.length) return null;

  return (
    <section className="agenda-group">
      <header>
        <div>
          <p>{description}</p>
          <h2>{title}</h2>
        </div>
        <span>{events.length}</span>
      </header>

      <div className="agenda-group__grid">
        {events.map((event) => (
          <EventCard key={eventKey(event)} score={event} showSport />
        ))}
      </div>
    </section>
  );
}

export function ScheduleExperience() {
  const { data, error } = useLiveFeed();
  const isLoading = data === null && !error;
  const [status, setStatus] = useState<StatusFilter>("all");
  const [date, setDate] = useState<DateFilter>("week");
  const [sport, setSport] = useState("all");
  const [competition, setCompetition] = useState("all");
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    sync();

    return subscribeFavorites(sync);
  }, []);

  const events = useMemo(() => {
    const all = [
      ...(data?.worldCup.events ?? []),
      ...(data?.feeds.flatMap((feed) => feed.scores) ?? []),
    ];

    return Array.from(new Map(all.map((event) => [eventKey(event), event])).values());
  }, [data]);

  const counts = useMemo(() => ({
    all: events.length,
    live: events.filter((event) => event.state === "in").length,
    next: events.filter((event) => event.state === "pre").length,
    finished: events.filter((event) => event.state === "post").length,
  }), [events]);

  const visible = useMemo(() => {
    const term = query.trim().toLocaleLowerCase("pt-BR");

    return events
      .filter((event) => {
        const searchable = [
          event.home.name,
          event.away.name,
          event.league,
          event.round || "",
          event.country || "",
        ].join(" ").toLocaleLowerCase("pt-BR");

        return (
          stateMatches(event, status) &&
          dateMatches(event, date) &&
          competitionMatches(event, competition) &&
          (sport === "all" || event.sportId === sport) &&
          (!term || searchable.includes(term))
        );
      })
      .sort((a, b) => compareEvents(a, b, favorites));
  }, [competition, date, events, favorites, query, sport, status]);

  const grouped = useMemo(() => {
    const live = visible.filter((event) => event.state === "in");
    const today = visible.filter((event) => event.state === "pre" && dateKey(event.startTime) === dateKey(null));
    const tomorrow = visible.filter((event) => event.state === "pre" && dateKey(event.startTime) === dateKey(null, 1));
    const upcoming = visible.filter((event) =>
      event.state === "pre" &&
      dateKey(event.startTime) !== dateKey(null) &&
      dateKey(event.startTime) !== dateKey(null, 1),
    );
    const finished = visible.filter((event) => event.state === "post");

    return { live, today, tomorrow, upcoming, finished };
  }, [visible]);

  const activeLabel =
    status === "live" ? "Ao vivo" :
    status === "next" ? "Proximos" :
    status === "finished" ? "Resultados" :
    "Todos os eventos";

  return (
    <main>
      <LapHeader />

      <div className="shell page hub-page">
        <section className="agenda-hero">
          <div>
            <p>Agenda LAP</p>
            <h1>Seu calendario esportivo</h1>
            <span>
              Jogos ao vivo, favoritos, proximos confrontos e resultados em um so lugar.
            </span>
          </div>

          <div className="agenda-hero__stats" aria-label="Resumo da agenda">
            <strong>{counts.live}<small>ao vivo</small></strong>
            <strong>{counts.next}<small>proximos</small></strong>
            <strong>{counts.finished}<small>resultados</small></strong>
          </div>
        </section>

        <section className="agenda-controls" aria-label="Filtros da agenda">
          <label className="agenda-search">
            <span className="sr-only">Buscar time ou competicao</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar time ou competicao"
            />
          </label>

          <select value={date} onChange={(event) => setDate(event.target.value as DateFilter)} aria-label="Periodo">
            <option value="all">Todas as datas</option>
            <option value="today">Hoje</option>
            <option value="tomorrow">Amanha</option>
            <option value="week">Proximos 7 dias</option>
          </select>

          <select
            value={sport}
            onChange={(event) => {
              setSport(event.target.value);

              if (event.target.value !== "futebol") setCompetition("all");
            }}
            aria-label="Modalidade"
          >
            <option value="all">Todas as modalidades</option>
            {SPORTS.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>

          <select
            value={competition}
            onChange={(event) => {
              const next = event.target.value;
              setCompetition(next);

              if (next !== "all") setSport("futebol");
            }}
            aria-label="Competicao"
          >
            <option value="all">Todas as ligas de futebol</option>
            {(data?.football.competitions ?? FOOTBALL_COMPETITIONS).map((item) => (
              <option key={item.id} value={item.id}>{item.name} - {item.country}</option>
            ))}
          </select>
        </section>

        <div className="agenda-status-filters" role="tablist" aria-label="Status dos jogos">
          <button type="button" role="tab" aria-selected={status === "all"} className={status === "all" ? "active" : ""} onClick={() => setStatus("all")}>
            Todos <span>{counts.all}</span>
          </button>
          <button type="button" role="tab" aria-selected={status === "live"} className={status === "live" ? "active" : ""} onClick={() => setStatus("live")}>
            Ao vivo <span>{counts.live}</span>
          </button>
          <button type="button" role="tab" aria-selected={status === "next"} className={status === "next" ? "active" : ""} onClick={() => setStatus("next")}>
            Proximos <span>{counts.next}</span>
          </button>
          <button type="button" role="tab" aria-selected={status === "finished"} className={status === "finished" ? "active" : ""} onClick={() => setStatus("finished")}>
            Resultados <span>{counts.finished}</span>
          </button>
        </div>

        <p className="agenda-result-note" aria-live="polite">
          {visible.length} evento{visible.length === 1 ? "" : "s"} em {activeLabel.toLocaleLowerCase("pt-BR")}.
          {favorites.length ? " Seus favoritos recebem prioridade." : ""}
        </p>

        {isLoading ? (
          <section className="agenda-loading" aria-live="polite" aria-label="Carregando agenda">
            <div>
              <p>Conectando ao radar</p>
              <h2>Carregando os jogos da Agenda</h2>
              <span>A LAP organiza os eventos assim que as fontes respondem.</span>
            </div>
            <div className="agenda-loading__grid" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>
        ) : visible.length ? (
          <div className="agenda-groups">
            <ScheduleGroup title="Ao vivo agora" description="Acompanhe em tempo real" events={grouped.live} />
            <ScheduleGroup title="Hoje" description="Proximos compromissos" events={grouped.today} />
            <ScheduleGroup title="Amanha" description="Para se planejar" events={grouped.tomorrow} />
            <ScheduleGroup title="Mais adiante" description="Proximos dias" events={grouped.upcoming} />
            <ScheduleGroup title="Resultados recentes" description="Partidas encerradas" events={grouped.finished} />
          </div>
        ) : (
          <section className="agenda-empty">
            <p>Nenhuma partida encontrada neste recorte.</p>
            <span>Troque a data, modalidade, liga ou termo de busca para ampliar a agenda.</span>
            <button type="button" onClick={() => {
              setStatus("all");
              setDate("week");
              setSport("all");
              setCompetition("all");
              setQuery("");
            }}>
              Limpar filtros
            </button>
          </section>
        )}

        {error && (
          <p className="status-note">
            A atualizacao mais recente nao chegou. A LAP tenta novamente sem apagar os ultimos dados validos.
          </p>
        )}
      </div>
    </main>
  );
}