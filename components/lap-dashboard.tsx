"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EventCard, eventHref } from "@/components/event-card";
import { HomeExplore } from "@/components/home-explore";
import { LapHeader, SportFavoriteButton } from "@/components/lap-header";
import { readFavorites, readNotificationPreferences, subscribeFavorites, toggleFavorite } from "@/lib/client-preferences";
import { SPORTS, type LivePayload, type NewsItem, type ScoreItem, type SportFeed, type SportId } from "@/lib/live-data";

type FeedState = "loading" | "ready" | "error";
type LapDashboardProps = { initialSport?: SportId | "todos" };
type LiveTab = "live" | "next" | "finished";

const ONBOARDING_KEY = "lap:onboarding:v1";
const NOTIFICATION_DEDUP_KEY = "lap:notification-dedup:v1";

function relativeTime(dateValue: string | null) {
  if (!dateValue) return "Agora";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Agora";
  const diffMinutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(diffMinutes) < 1) return "agora";
  if (diffMinutes > 0 && diffMinutes < 60) return `em ${diffMinutes} min`;
  if (diffMinutes < 0 && diffMinutes > -60) return `há ${Math.abs(diffMinutes)} min`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function updatedTime(dateValue: string | null | undefined) {
  if (!dateValue) return "—";
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function dateAndTime(dateValue: string | null) {
  if (!dateValue) return "Data a confirmar";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function localTime(dateValue: string | null) {
  if (!dateValue) return "Horário a confirmar";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Horário a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function updatedAgo(dateValue: string | null | undefined, now: number) {
  if (now <= 0) return "Atualização pendente";
  if (!dateValue) return "Atualização pendente";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Atualização pendente";
  const diffSeconds = Math.max(0, Math.floor((now - date.getTime()) / 1000));
  if (diffSeconds < 60) return `Atualizado há ${diffSeconds} segundo${diffSeconds === 1 ? "" : "s"}`;
  const minutes = Math.floor(diffSeconds / 60);
  if (minutes < 60) return `Atualizado há ${minutes} minuto${minutes === 1 ? "" : "s"}`;
  const hours = Math.floor(minutes / 60);
  return `Atualizado há ${hours} hora${hours === 1 ? "" : "s"}`;
}

function sameLocalDay(dateValue: string | null, now: number) {
  if (now <= 0) return false;
  if (!dateValue) return false;
  const eventDate = new Date(dateValue);
  if (Number.isNaN(eventDate.getTime())) return false;
  const today = new Date(now);
  return eventDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) === today.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function gameLabel(score: ScoreItem) {
  return score.eventKind === "race" ? `${score.home.name} · Fórmula 1` : `${score.home.name} x ${score.away.name}`;
}

function matchFavoriteScore(score: ScoreItem, favorites = readFavorites()) {
  return favorites.some((item) => {
    if (item.id === `event:${score.sportId}:${score.id}`) return true;
    if (item.id === `sport:${score.sportId}`) return true;
    if (score.competitionId && item.id === `league:${score.competitionId}`) return true;
    return item.type === "team" && `${score.home.name} ${score.away.name}`.toLowerCase().includes(item.label.toLowerCase());
  });
}

function statusText(score: ScoreItem) {
  const raw = score.status || "";
  if (score.state === "in") return raw || "Ao vivo";
  if (score.state === "post") return raw || "Encerrado";
  if (/postponed|adiad/i.test(raw)) return "Adiado";
  return score.startTime ? localTime(score.startTime) : "Horário a confirmar";
}

function readNotificationDedupe() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const parsed = JSON.parse(window.localStorage.getItem(NOTIFICATION_DEDUP_KEY) || "[]") as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set<string>();
  }
}

function notifyOnce(key: string, title: string, body: string) {
  const seen = readNotificationDedupe();
  if (seen.has(key)) return;
  seen.add(key);
  window.localStorage.setItem(NOTIFICATION_DEDUP_KEY, JSON.stringify([...seen].slice(-80)));
  new Notification(title, { body, tag: key });
}

function NewsCard({ item, large = false }: { item: NewsItem; large?: boolean }) {
  return (
    <Link className={`news-card ${large ? "news-card--large" : ""}`} href={item.internalUrl}>
      <div className="news-card__topline"><span>{item.kind === "editorial" ? "LAP" : item.source}</span><span>{relativeTime(item.publishedAt)}</span></div>
      <h3>{item.title}</h3>
      {!large && <p className="news-card__excerpt">{item.excerpt}</p>}
      <span className="news-card__more">Ler na LAP <span aria-hidden>→</span></span>
    </Link>
  );
}

function SportSection({ feed, featured }: { feed: SportFeed; featured?: boolean }) {
  const firstNews = feed.news[0];
  const restNews = feed.news.slice(1, 4);
  const schedule = feed.scores.slice(0, 3);
  return (
    <section className="sport-section" id={feed.id}>
      <header className="section-heading">
        <div><p>{feed.icon} Modalidade</p><h2>{feed.name}</h2></div>
        <div className="section-heading__actions"><SportFavoriteButton sportId={feed.id} /><Link href={`/modalidades/${feed.id}`} className="section-link">Abrir cobertura</Link></div>
      </header>
      {firstNews || schedule.length ? (
        <div className={`sport-layout ${featured ? "sport-layout--featured" : ""}`}>
          <div className="sport-layout__lead">{firstNews ? <NewsCard item={firstNews} large /> : <div className="empty-card">A próxima matéria em destaque aparecerá aqui.</div>}</div>
          <div className="sport-layout__news">{restNews.length ? restNews.map((item) => <NewsCard key={item.id} item={item} />) : <div className="empty-card">Novas atualizações serão adicionadas assim que surgirem.</div>}</div>
          <div className="sport-layout__scores"><p className="mini-heading">Agenda e resultados</p>{schedule.length ? schedule.map((score) => <EventCard key={score.id} score={score} compact />) : <div className="empty-card">A agenda desta modalidade será exibida quando houver partidas confirmadas.</div>}</div>
        </div>
      ) : <div className="empty-card empty-card--wide">A LAP está preparando a cobertura desta modalidade.</div>}
    </section>
  );
}

function scoreTime(score: ScoreItem) { return score.startTime ? new Date(score.startTime).getTime() : 0; }
function orderEvents(events: ScoreItem[]) {
  const unique = Array.from(new Map(events.map((event) => [`${event.sportId}-${event.id}-${event.isWorldCup ? "cup" : "main"}`, event])).values());
  const live = unique.filter((item) => item.state === "in");
  const upcoming = unique.filter((item) => item.state === "pre").sort((a, b) => scoreTime(a) - scoreTime(b));
  const finished = unique.filter((item) => item.state === "post").sort((a, b) => scoreTime(b) - scoreTime(a));
  return { live, upcoming, finished, all: [...live, ...upcoming, ...finished] };
}

function groupByLeague(events: ScoreItem[]) {
  const groups = new Map<string, ScoreItem[]>();
  for (const event of events) {
    const key = event.league || event.round || "Eventos";
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  return [...groups.entries()].map(([league, items]) => ({ league, items }));
}

function FeaturedGameCard({ score }: { score: ScoreItem | null }) {
  if (!score) {
    return (
      <article className="live-feature live-feature--empty">
        <p>Jogo em destaque</p>
        <h3>Aguardando o próximo evento relevante</h3>
        <span>A LAP mantém notícias e agenda no ar enquanto a fonte publica novos jogos.</span>
        <Link href="/agenda" className="live-feature__button">Abrir agenda</Link>
      </article>
    );
  }
  const scoreLine = score.eventKind === "race" ? score.status : `${score.home.score ?? "—"} x ${score.away.score ?? "—"}`;
  const recent = [
    score.state === "in" ? score.status : null,
    score.state === "pre" ? `Começa ${dateAndTime(score.startTime)}` : null,
    score.state === "post" ? `Final: ${score.status}` : null,
    score.venue ? `Local: ${score.venue}` : null,
    score.broadcast ? `Transmissão: ${score.broadcast}` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <article className="live-feature">
      <div className="live-feature__meta"><span className={score.state === "in" ? "live-label" : "status-label"}>{statusText(score)}</span><span>{score.league}</span></div>
      <div className="live-feature__score">
        <div><strong>{score.home.name}</strong><span>{score.home.score ?? "—"}</span></div>
        <em>{score.eventKind === "race" ? "GP" : "x"}</em>
        <div><strong>{score.away.name}</strong><span>{score.away.score ?? "—"}</span></div>
      </div>
      <p>{scoreLine}</p>
      <ul>{recent.slice(0, 3).map((item) => <li key={item}>{item}</li>)}</ul>
      <Link href={eventHref(score)} className="live-feature__button">Acompanhar jogo</Link>
    </article>
  );
}

function LiveOperationsCenter({ payload, events, status, now }: { payload: LivePayload | null; events: ScoreItem[]; status: FeedState; now: number }) {
  const [tab, setTab] = useState<LiveTab>("live");
  const ordered = useMemo(() => orderEvents(events), [events]);
  const todayUpcoming = useMemo(() => ordered.upcoming.filter((score) => sameLocalDay(score.startTime, now)), [ordered.upcoming, now]);
  const featured = ordered.live[0] || todayUpcoming[0] || ordered.upcoming[0] || ordered.finished[0] || null;
  const selected = tab === "live" ? ordered.live : tab === "next" ? ordered.upcoming : ordered.finished;
  const fallback = tab === "live" && !selected.length ? (todayUpcoming.length ? todayUpcoming : ordered.upcoming).slice(0, 6) : selected.slice(0, 6);
  const groups = groupByLeague(fallback);
  const sourceIssue = Boolean(payload && (payload.feeds.some((feed) => feed.sourceStatus !== "live") || payload.worldCup.sourceStatus !== "ok" || status === "error"));
  const tabLabel = tab === "live" ? "Ao vivo" : tab === "next" ? "Próximos" : "Resultados";
  const localClock = now > 0 ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(now)) : "--:--:--";

  return (
    <section className="live-center" id="central-ao-vivo" aria-labelledby="live-center-title">
      <header className="live-center__header">
        <div>
          <p>Central Ao Vivo</p>
          <h2 id="live-center-title">Ao vivo, próximos e resultados</h2>
          <span>Jogos agrupados por campeonato, com status claro, horário local e fallback do último retorno válido.</span>
        </div>
        <div className="live-center__freshness">
          <strong>{updatedAgo(payload?.generatedAt, now)}</strong>
          <small>Horário local {localClock}</small>
        </div>
        <Link href="/agenda" className="live-center__agenda-link">Ver agenda completa {"\u2192"}</Link>
      </header>

      {sourceIssue && <p className="live-center__warning">Atualização discreta: alguma fonte está atrasada. A LAP preserva a última resposta válida e tenta reconectar sem zerar a home.</p>}

      <div className="live-center__layout">
        <FeaturedGameCard score={featured} />
        <div className="live-center__board">
          <div className="live-tabs" role="tablist" aria-label="Filtrar central ao vivo">
            <button type="button" role="tab" aria-selected={tab === "live"} className={tab === "live" ? "active" : ""} onClick={() => setTab("live")}>Ao vivo <span>{ordered.live.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === "next"} className={tab === "next" ? "active" : ""} onClick={() => setTab("next")}>Próximos <span>{ordered.upcoming.length}</span></button>
            <button type="button" role="tab" aria-selected={tab === "finished"} className={tab === "finished" ? "active" : ""} onClick={() => setTab("finished")}>Resultados <span>{ordered.finished.length}</span></button>
          </div>
          {tab === "live" && !ordered.live.length && fallback.length > 0 && <p className="live-center__notice">Nenhum jogo ao vivo agora. Mostrando os próximos eventos relevantes para manter a home ativa.</p>}
          {groups.length ? (
            <div className="live-groups" aria-label={`${tabLabel} por campeonato`}>
              {groups.map((group) => (
                <article key={group.league} className="live-group">
                  <header><h3>{group.league}</h3><span>{group.items.length}</span></header>
                  <div>{group.items.map((event) => <EventCard key={`${event.sportId}-${event.id}-${event.isWorldCup ? "cup" : "main"}`} score={event} compact showSport />)}</div>
                </article>
              ))}
            </div>
          ) : <div className="empty-card">A central está pronta, mas ainda não recebeu eventos neste recorte. As notícias e favoritos continuam disponíveis.</div>}
        </div>
      </div>
    </section>
  );
}

function WorldCupSpotlight({ scores }: { scores: ScoreItem[] }) {
  const ordered = useMemo(() => orderEvents(scores), [scores]);
  const featured = ordered.live[0] || ordered.upcoming[0] || ordered.finished[0];
  return (
    <section className="world-cup world-cup--spotlight" aria-labelledby="copa-title">
      <div className="world-cup__topbar"><div><p>Especial LAP</p><h2 id="copa-title">Copa do Mundo 2026</h2></div><Link className="world-cup__open" href="/copa-2026">Abrir central completa →</Link></div>
      <div className="world-cup__intro">
        <div><span className="cup-kicker">Partidas, chaveamento e Seleção Brasileira</span><h3>A Copa em um único lugar, jogo a jogo.</h3><p>Acompanhe os confrontos ao vivo, todos os resultados e a agenda da fase decisiva.</p></div>
        <div className="cup-next-match">{featured ? <><span>{featured.state === "in" ? "Em jogo" : featured.state === "post" ? "Último resultado" : "Próximo destaque"}</span><strong>{featured.home.name} <em>×</em> {featured.away.name}</strong><small>{featured.state === "post" ? featured.status : dateAndTime(featured.startTime)}</small></> : <><span>Agenda da Copa</span><strong>Jogos confirmados aparecerão aqui</strong><small>Central preparada para acompanhar o torneio.</small></>}</div>
      </div>
      <div className="world-cup__mini-grid">{ordered.live.slice(0, 1).map((score) => <EventCard key={score.id} score={score} cup />)}{ordered.upcoming.slice(0, 2).map((score) => <EventCard key={score.id} score={score} cup />)}{!ordered.live.length && !ordered.upcoming.length && ordered.finished.slice(0, 3).map((score) => <EventCard key={score.id} score={score} cup />)}</div>
    </section>
  );
}

function SchedulePreview({ scores }: { scores: ScoreItem[] }) {
  const ordered = useMemo(() => orderEvents(scores), [scores]);
  const preview = ordered.all.slice(0, 4);
  return (
    <section className="full-schedule" id="agenda" aria-labelledby="agenda-title">
      <div className="full-schedule__heading"><div><p>Agenda LAP</p><h2 id="agenda-title">Partidas e resultados</h2></div><Link href="/agenda" className="section-link">Ver agenda completa</Link></div>
      {preview.length ? <div className="full-schedule__grid">{preview.map((score) => <EventCard key={`${score.sportId}-${score.id}`} score={score} showSport />)}</div> : <div className="empty-card">A agenda será preenchida com os próximos eventos confirmados.</div>}
    </section>
  );
}

function FavoritesOnboarding({ payload }: { payload: LivePayload | null }) {
  const [open, setOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const alreadyDone = window.localStorage.getItem(ONBOARDING_KEY) === "done";
    const current = readFavorites();
    setSelectedIds(new Set(current.map((item) => item.id)));
    if (!alreadyDone && current.length === 0) setOpen(true);
  }, []);

  function choose(item: { id: string; type: "sport" | "league" | "team"; label: string; href: string }) {
    const active = toggleFavorite(item);
    setSelectedIds((current) => {
      const next = new Set(current);
      if (active) next.add(item.id); else next.delete(item.id);
      return next;
    });
  }

  function addTeam() {
    const label = teamName.trim();
    if (!label) return;
    const id = `team:${label.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
    choose({ id, type: "team", label, href: "/favoritos" });
    setTeamName("");
  }

  function finish() {
    window.localStorage.setItem(ONBOARDING_KEY, "done");
    setOpen(false);
  }

  if (!open) return null;

  const prioritySports = SPORTS.filter((sport) => ["futebol", "futebol-americano", "formula1"].includes(sport.id));
  const priorityLeagues = (payload?.football.competitions ?? []).filter((competition) => ["brasileirao-a", "brasileirao-b", "copa-do-brasil", "libertadores", "sul-americana", "premier-league", "champions", "la-liga", "serie-a", "bundesliga"].includes(competition.id));

  return (
    <section className="favorites-onboarding" aria-labelledby="favorites-onboarding-title">
      <div>
        <p>Primeiro acesso</p>
        <h2 id="favorites-onboarding-title">Monte sua central esportiva</h2>
        <span>Escolha esportes e ligas para priorizar a home, favoritos e alertas do navegador.</span>
      </div>
      <div className="favorites-onboarding__choices">
        <div>
          <strong>Meus esportes</strong>
          {prioritySports.map((sport) => <button key={sport.id} type="button" className={selectedIds.has(`sport:${sport.id}`) ? "active" : ""} onClick={() => choose({ id: `sport:${sport.id}`, type: "sport", label: sport.name, href: `/modalidades/${sport.id}` })}>{sport.icon} {sport.name}</button>)}
        </div>
        <div>
          <strong>Minhas ligas</strong>
          {priorityLeagues.map((competition) => <button key={competition.id} type="button" className={selectedIds.has(`league:${competition.id}`) ? "active" : ""} onClick={() => choose({ id: `league:${competition.id}`, type: "league", label: competition.name, href: `/campeonatos/${competition.id}` })}>{competition.name}</button>)}
        </div>
        <div className="favorites-onboarding__team">
          <strong>Meus times</strong>
          <input value={teamName} onChange={(event) => setTeamName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addTeam(); }} placeholder="Ex.: Flamengo, Chiefs, Ferrari" />
          <button type="button" onClick={addTeam}>Adicionar</button>
        </div>
      </div>
      <button type="button" className="favorites-onboarding__done" onClick={finish}>Entrar na minha LAP</button>
    </section>
  );
}

function applyScorePatch(payload: LivePayload, patch: { eventId: string; sportId?: SportId; state?: ScoreItem["state"]; status?: string; homeScore?: string | number | null; awayScore?: string | number | null; occurredAt?: string }): LivePayload {
  const patchItem = (score: ScoreItem) => {
    if (score.id !== patch.eventId || (patch.sportId && score.sportId !== patch.sportId)) return score;
    return { ...score, state: patch.state || score.state, status: patch.status || score.status, home: { ...score.home, score: patch.homeScore === undefined ? score.home.score : patch.homeScore === null ? null : String(patch.homeScore) }, away: { ...score.away, score: patch.awayScore === undefined ? score.away.score : patch.awayScore === null ? null : String(patch.awayScore) } };
  };
  return { ...payload, generatedAt: patch.occurredAt || new Date().toISOString(), feeds: payload.feeds.map((feed) => ({ ...feed, scores: feed.scores.map(patchItem) })), worldCup: { ...payload.worldCup, events: payload.worldCup.events.map(patchItem) } };
}

function useLiveNotifications(payload: LivePayload | null) {
  const previous = useRef<LivePayload | null>(null);
  useEffect(() => {
    if (!payload) return;
    const prior = previous.current;
    previous.current = payload;
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const preferences = readNotificationPreferences();
    if (!preferences.enabled) return;
    const favorites = readFavorites();
    const current = [...payload.worldCup.events, ...payload.feeds.flatMap((feed) => feed.scores)];

    for (const score of current) {
      const favorite = matchFavoriteScore(score, favorites);
      if (preferences.favoriteOnly && !favorite) continue;
      if (score.state === "pre" && score.startTime) {
        const startsIn = new Date(score.startTime).getTime() - Date.now();
        if (startsIn >= 0 && startsIn <= 30 * 60_000) {
          notifyOnce(`lap-soon-${score.sportId}-${score.id}-${score.startTime}`, `LAP · ${gameLabel(score)} em 30 minutos`, `${score.league} · ${dateAndTime(score.startTime)}`);
        }
      }
    }

    if (!prior) return;
    const priorScores = new Map([...prior.worldCup.events, ...prior.feeds.flatMap((feed) => feed.scores)].map((score) => [`${score.sportId}:${score.id}`, score]));
    for (const score of current) {
      const old = priorScores.get(`${score.sportId}:${score.id}`);
      if (!old) continue;
      const changed = old.home.score !== score.home.score || old.away.score !== score.away.score || old.state !== score.state;
      const favorite = matchFavoriteScore(score, favorites);
      if (changed && (!preferences.favoriteOnly || favorite)) {
        const title =
          old.state !== "in" && score.state === "in" ? `LAP · Começou: ${gameLabel(score)}` :
          old.state !== "post" && score.state === "post" ? `LAP · Encerrado: ${gameLabel(score)}` :
          old.home.score !== score.home.score || old.away.score !== score.away.score ? `LAP · Placar mudou: ${gameLabel(score)}` :
          `LAP · Atualização: ${gameLabel(score)}`;
        notifyOnce(`lap-change-${score.sportId}-${score.id}-${score.state}-${score.home.score}-${score.away.score}`, title, score.status);
      }
    }
  }, [payload]);
}

export function LapDashboard({ initialSport = "todos" }: LapDashboardProps) {
  const [data, setData] = useState<LivePayload | null>(null);
  const [status, setStatus] = useState<FeedState>("loading");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const refreshInFlight = useRef(false);

  const refresh = useCallback(async (manual = false) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    if (manual) setIsRefreshing(true);
    try {
      const response = await fetch(`/api/live?ts=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Falha ao atualizar");
      setData(await response.json() as LivePayload);
      setStatus("ready");
    } catch {
      setStatus((current) => current === "loading" ? "error" : current);
    } finally {
      refreshInFlight.current = false;
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh(false);
    const timer = window.setInterval(() => void refresh(false), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const sync = () => setFavoriteIds(new Set(readFavorites().map((item) => item.id)));
    sync();
    return subscribeFavorites(sync);
  }, []);

  useEffect(() => {
    if (!("EventSource" in window)) return;
    const source = new EventSource("/api/live/stream");
    source.addEventListener("snapshot", (event) => {
      try { setData(JSON.parse((event as MessageEvent<string>).data) as LivePayload); setStatus("ready"); } catch { /* Mantém último estado válido. */ }
    });
    source.addEventListener("score", (event) => {
      try {
        const patch = JSON.parse((event as MessageEvent<string>).data) as Parameters<typeof applyScorePatch>[1];
        setData((current) => current ? applyScorePatch(current, patch) : current);
      } catch { /* Próxima atualização de segurança reconcilia os dados. */ }
    });
    return () => source.close();
  }, []);

  useLiveNotifications(data);

  const feedsWithEditorial = useMemo(() => data ? data.feeds.map((feed) => ({ ...feed, news: [...data.editorial.filter((article) => article.sportId === feed.id), ...feed.news] })) : [], [data]);
  const allScores = useMemo(() => feedsWithEditorial.flatMap((feed) => feed.scores), [feedsWithEditorial]);
  const liveScores = useMemo(() => allScores.filter((score) => score.state === "in"), [allScores]);
  const allNews = useMemo(() => feedsWithEditorial.flatMap((feed) => feed.news), [feedsWithEditorial]);
  const featuredNews = allNews[0] ?? null;
  const liveCenterEvents = useMemo(() => {
    const all = [...allScores, ...(data?.worldCup.events ?? [])];
    const weight = (score: ScoreItem) =>
      (favoriteIds.has(`event:${score.sportId}:${score.id}`) ? 4 : 0) +
      (score.competitionId && favoriteIds.has(`league:${score.competitionId}`) ? 3 : 0) +
      (favoriteIds.has(`sport:${score.sportId}`) ? 2 : 0);
    return [...all].sort((a, b) => weight(b) - weight(a));
  }, [allScores, data, favoriteIds]);
  const visibleFeeds = useMemo(() => feedsWithEditorial
    .filter((feed) => initialSport === "todos" || feed.id === initialSport)
    .sort((a, b) => Number(favoriteIds.has(`sport:${b.id}`)) - Number(favoriteIds.has(`sport:${a.id}`))), [feedsWithEditorial, initialSport, favoriteIds]);
  const selectedSport = initialSport === "todos" ? null : SPORTS.find((sport) => sport.id === initialSport) ?? null;
  const homeFeeds = useMemo(
    () => visibleFeeds.slice(0, initialSport === "todos" ? 4 : 1),
    [visibleFeeds, initialSport],
  );  const hasLiveData = data !== null;

  return (
    <main id="main-content" tabIndex={-1}>
      <LapHeader activeSport={initialSport} onRefresh={() => void refresh(true)} isRefreshing={isRefreshing} />
      <div className="shell page" id="top">
        <section className="hero-grid" aria-label="Visão geral de atualizações esportivas">
          <div className="hero-copy"><div className="eyebrow"><span className="pulse-dot" aria-hidden /> COBERTURA CONTÍNUA</div><h1>{selectedSport ? `${selectedSport.name} ao vivo, no ritmo do agora.` : "O mundo do esporte, no ritmo do agora."}</h1><p>{selectedSport ? `Notícias, partidas, favoritos e resultados de ${selectedSport.name.toLowerCase()} em uma central própria da LAP.` : "Futebol mundial, Brasileirão, NFL, Fórmula 1, resultados, matérias e alertas no mesmo painel."}</p><div className="hero-copy__meta" aria-live="polite">
  <span>{hasLiveData ? `${data?.football.competitions.length} ligas mapeadas` : "Conectando ao radar"}</span>
  <span className="hero-copy__separator" aria-hidden="true" />
  <span>{hasLiveData ? `${data?.worldCup.events.length} jogos da Copa` : "Agenda e not\u00edcias em tempo real"}</span>
  <span className="hero-copy__separator" aria-hidden="true" />
  <span>{hasLiveData ? `Atualizado em ${updatedTime(data?.generatedAt)}` : "Dados sendo atualizados"}</span>
</div></div>
          <div className="hero-featured">{featuredNews ? <NewsCard item={featuredNews} large /> : <div className="skeleton-card">Carregando a principal história da LAP…</div>}</div>
          <aside className="live-radar" aria-label="Radar ao vivo">
  <div className="live-radar__heading">
    <div><p>Radar</p><h2>Ao vivo</h2></div>
    <span>{hasLiveData ? liveScores.length : "—"}</span>
  </div>
  <div className="live-radar__list">
    {!hasLiveData
      ? <div className="empty-card">Conectando aos jogos ao vivo...</div>
      : liveScores.length
        ? liveScores.slice(0, 3).map((score) => <EventCard key={`${score.sportId}-${score.id}`} score={score} compact />)
        : <div className="empty-card">Nenhuma partida em andamento agora.</div>}
  </div>
</aside>
        </section>

        <FavoritesOnboarding payload={data} />
        <LiveOperationsCenter payload={data} events={liveCenterEvents} status={status} now={now} />
        <WorldCupSpotlight scores={data?.worldCup.events ?? []} />
        <section className="dashboard-stats" aria-label="Resumo da LAP">
  <div>
    <strong>{hasLiveData ? data?.feeds.length : "—"}</strong>
    <span>{hasLiveData ? "modalidades acompanhadas" : "dados ao vivo"}</span>
  </div>
  <div>
    <strong>{hasLiveData ? data?.football.competitions.length : "—"}</strong>
    <span>{hasLiveData ? "ligas mapeadas" : "carregando cobertura"}</span>
  </div>
  <div>
    <strong>{hasLiveData ? allScores.length : "—"}</strong>
    <span>{hasLiveData ? "eventos no radar" : "agenda sendo atualizada"}</span>
  </div>
  <div>
    <strong>{hasLiveData ? `${data?.refreshSeconds ?? 30}s` : "—"}</strong>
    <span>{"atualiza\u00e7\u00e3o de seguran\u00e7a"}</span>
  </div>
</section>
        {status === "loading" && <section className="loading-state" aria-live="polite">Carregando o radar esportivo da LAP…</section>}
        {status === "error" && <section className="error-state" aria-live="assertive">A LAP ainda não conseguiu atualizar. Tente novamente em alguns instantes.</section>}
        <SchedulePreview scores={[...allScores, ...(data?.worldCup.events ?? [])]} />
        {initialSport === "todos" ? (
          <HomeExplore />
        ) : (
          <>
            <section className="feed-toolbar" aria-label="Cobertura por modalidade">
              <div>
                <p>Central de modalidades</p>
                <h2>{selectedSport?.name ?? "Todos os esportes"}</h2>
              </div>
              <p className="feed-toolbar__note">
                Abra qualquer modalidade para ver not{"\u00ed"}cias, jogos e favoritos em uma p{"\u00e1"}gina dedicada.
              </p>
            </section>
            <div className="sports-feed">
              {homeFeeds.map((feed, index) => (
                <SportSection key={feed.id} feed={feed} featured={index === 0} />
              ))}
            </div>
          </>
        )}
      </div>
      <footer className="footer"><div className="shell footer__inside"><div><strong>LAP</strong><span>live sports</span></div><p>Notícias, jogos, alertas e contexto para viver o esporte em um só lugar.</p></div></footer>
    </main>
  );
}
