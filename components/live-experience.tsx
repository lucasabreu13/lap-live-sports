"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard, eventHref } from "@/components/event-card";
import { FavoriteButton } from "@/components/favorite-button";
import { GameAlertButton } from "@/components/game-alert-button";
import { readFavorites, subscribeFavorites, type FavoriteItem } from "@/lib/client-preferences";
import type { LivePayload, ScoreItem, SportId } from "@/lib/live-data";

type LiveStatus = "all" | "live" | "upcoming" | "finished";
type LiveExperienceProps = {
  payload: LivePayload | null;
  events: ScoreItem[];
  status: "loading" | "ready" | "error";
  now: number;
};

function eventKey(score: ScoreItem) { return `${score.sportId}:${score.id}`; }
function favoriteKey(score: ScoreItem) { return `event:${score.sportId}:${score.id}`; }

function scoreTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;
  const value = new Date(score.startTime).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

function isBrazilRelevant(score: ScoreItem) {
  return /brasil|brazil|brasileir[aÃ£]o|copa do brasil/i.test(`${score.home.name} ${score.away.name} ${score.league} ${score.country || ""}`);
}

function isFavoriteMatch(score: ScoreItem, favorites: FavoriteItem[]) {
  return favorites.some((favorite) => {
    if (favorite.id === favoriteKey(score)) return true;
    if (favorite.id === `sport:${score.sportId}`) return true;
    if (score.competitionId && favorite.id === `league:${score.competitionId}`) return true;
    return favorite.type === "team" && `${score.home.name} ${score.away.name}`.toLowerCase().includes(favorite.label.toLowerCase());
  });
}

function priority(score: ScoreItem, favorites: FavoriteItem[], now: number) {
  let value = 0;
  if (score.state === "in") value += 100000;
  if (isFavoriteMatch(score, favorites)) value += 70000;
  if (isBrazilRelevant(score)) value += 30000;
  if (score.isWorldCup) value += 25000;
  if (score.sportId === "futebol") value += 3000;

  if (score.state === "pre") {
    const minutes = Math.max(0, Math.floor((scoreTime(score) - now) / 60_000));
    value += Math.max(0, 12000 - Math.min(12000, minutes * 10));
  }

  if (score.state === "post") value -= Math.min(10000, Math.max(0, (now - scoreTime(score)) / 60_000));
  return value;
}

function formatWhen(score: ScoreItem) {
  if (score.state === "in") return score.status || "Ao vivo";
  if (score.state === "post") return score.status || "Encerrado";
  if (!score.startTime) return "HorÃ¡rio a confirmar";

  const date = new Date(score.startTime);
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (minutes >= 0 && minutes <= 60) return `ComeÃ§a em ${minutes} min`;

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  }).format(date);
}

function freshness(value: string | null | undefined, now: number) {
  if (!value || !now) return "Conectando ao radar";
  const diff = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (diff < 10) return "Atualizado agora";
  if (diff < 60) return `Atualizado hÃ¡ ${diff}s`;
  return `Atualizado hÃ¡ ${Math.floor(diff / 60)} min`;
}

function PreviewDrawer({ score, onClose }: { score: ScoreItem; onClose: () => void }) {
  const href = eventHref(score);
  const label = `${score.home.name} x ${score.away.name}`;

  return (
    <div className="live-preview__backdrop" role="presentation" onMouseDown={onClose}>
      <section className="live-preview" role="dialog" aria-modal="true" aria-label={`Resumo de ${label}`} onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className="live-preview__close" onClick={onClose} aria-label="Fechar resumo">Ã—</button>
        <p className="live-preview__eyebrow">{score.league} {score.round ? `Â· ${score.round}` : ""}</p>
        <div className="live-preview__teams">
          <div><strong>{score.home.name}</strong><span>{score.home.score ?? "â€”"}</span></div>
          <em>Ã—</em>
          <div><strong>{score.away.name}</strong><span>{score.away.score ?? "â€”"}</span></div>
        </div>
        <p className="live-preview__status">{formatWhen(score)}</p>
        <dl className="live-preview__info">
          <div><dt>Local</dt><dd>{score.venue || "A confirmar"}</dd></div>
          <div><dt>TransmissÃ£o</dt><dd>{score.broadcast || "Em atualizaÃ§Ã£o"}</dd></div>
          <div><dt>Status</dt><dd>{score.status || "Agenda confirmada"}</dd></div>
        </dl>
        <div className="live-preview__actions">
          <FavoriteButton id={favoriteKey(score)} type="event" label={label} href={href} />
          {score.state !== "post" && <GameAlertButton eventId={favoriteKey(score)} label={label} />}
          <Link href={href} className="live-preview__details">Abrir detalhes completos</Link>
        </div>
      </section>
    </div>
  );
}

export function LiveExperience({ payload, events, status, now }: LiveExperienceProps) {
  const [statusFilter, setStatusFilter] = useState<LiveStatus>("all");
  const [sportFilter, setSportFilter] = useState<"all" | SportId>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [preview, setPreview] = useState<ScoreItem | null>(null);

  useEffect(() => {
    const sync = () => setFavorites(readFavorites());
    sync();
    return subscribeFavorites(sync);
  }, []);

  const deduped = useMemo(() => Array.from(new Map(events.map((score) => [eventKey(score), score])).values()), [events]);

  const counters = useMemo(() => ({
    all: deduped.length,
    live: deduped.filter((score) => score.state === "in").length,
    upcoming: deduped.filter((score) => score.state === "pre").length,
    finished: deduped.filter((score) => score.state === "post").length,
  }), [deduped]);

  const filtered = useMemo(() => deduped
    .filter((score) => {
      if (statusFilter === "live" && score.state !== "in") return false;
      if (statusFilter === "upcoming" && score.state !== "pre") return false;
      if (statusFilter === "finished" && score.state !== "post") return false;
      if (sportFilter !== "all" && score.sportId !== sportFilter) return false;
      if (favoritesOnly && !isFavoriteMatch(score, favorites)) return false;
      return true;
    })
    .sort((a, b) => priority(b, favorites, now) - priority(a, favorites, now)), [deduped, favorites, favoritesOnly, now, sportFilter, statusFilter]);

  const allRanked = useMemo(() => deduped.slice().sort((a, b) => priority(b, favorites, now) - priority(a, favorites, now)), [deduped, favorites, now]);
  const feature = filtered[0] ?? allRanked[0] ?? null;
  const remaining = filtered.filter((score) => !feature || eventKey(score) !== eventKey(feature)).slice(0, 12);

  const groups = useMemo(() => {
    const map = new Map<string, ScoreItem[]>();
    for (const score of remaining) {
      const key = score.league || "Eventos em destaque";
      map.set(key, [...(map.get(key) ?? []), score]);
    }
    return [...map.entries()].map(([league, items]) => ({ league, items }));
  }, [remaining]);

  const nextEvent = deduped.filter((score) => score.state === "pre").sort((a, b) => scoreTime(a) - scoreTime(b))[0] ?? null;
  const sourceIssue = status === "error" || Boolean(payload && payload.feeds.some((feed) => feed.sourceStatus !== "live"));

  function resetFilters() {
    setStatusFilter("all");
    setSportFilter("all");
    setFavoritesOnly(false);
  }

  return (
    <>
      <section className="live-experience" id="central-ao-vivo" aria-labelledby="live-experience-title">
        <header className="live-experience__header">
          <div>
            <p>Central Ao Vivo</p>
            <h2 id="live-experience-title">O que importa agora</h2>
            <span>Partidas ordenadas por ao vivo, favoritos, Brasil, Copa do Mundo e prÃ³ximos jogos.</span>
          </div>
          <div className="live-experience__freshness"><strong>{freshness(payload?.generatedAt, now)}</strong><small>HorÃ¡rio de SÃ£o Paulo</small></div>
        </header>

        {sourceIssue && <p className="live-experience__warning">Algumas fontes estÃ£o atualizando. A LAP preserva o Ãºltimo retorno vÃ¡lido enquanto reconecta.</p>}

        <div className="live-filterbar" role="group" aria-label="Filtros da central ao vivo">
          <button type="button" className={statusFilter === "all" && sportFilter === "all" && !favoritesOnly ? "active" : ""} onClick={resetFilters}>Todos <span>{counters.all}</span></button>
          <button type="button" className={statusFilter === "live" ? "active" : ""} onClick={() => { setStatusFilter("live"); setFavoritesOnly(false); }}>Ao vivo <span>{counters.live}</span></button>
          <button type="button" className={statusFilter === "upcoming" ? "active" : ""} onClick={() => { setStatusFilter("upcoming"); setFavoritesOnly(false); }}>PrÃ³ximos <span>{counters.upcoming}</span></button>
          <button type="button" className={statusFilter === "finished" ? "active" : ""} onClick={() => { setStatusFilter("finished"); setFavoritesOnly(false); }}>Encerrados <span>{counters.finished}</span></button>
          <button type="button" className={sportFilter === "futebol" ? "active" : ""} onClick={() => { setSportFilter("futebol"); setStatusFilter("all"); }}>Futebol</button>
          <button type="button" className={sportFilter === "futebol-americano" ? "active" : ""} onClick={() => { setSportFilter("futebol-americano"); setStatusFilter("all"); }}>NFL</button>
          <button type="button" className={sportFilter === "formula1" ? "active" : ""} onClick={() => { setSportFilter("formula1"); setStatusFilter("all"); }}>FÃ³rmula 1</button>
          <button type="button" className={favoritesOnly ? "active" : ""} onClick={() => { setFavoritesOnly((current) => !current); setStatusFilter("all"); }}>Favoritos</button>
        </div>

        <div className="live-experience__layout">
          <div className="live-experience__feature">
            <div className="live-experience__feature-heading">
              <div><p>Em destaque</p><h3>{feature?.state === "in" ? "Acompanhe agora" : feature && isFavoriteMatch(feature, favorites) ? "Seu jogo prioritÃ¡rio" : "PrÃ³ximo destaque"}</h3></div>
              {feature && <span>{feature.state === "in" ? "AO VIVO" : formatWhen(feature)}</span>}
            </div>
            {feature ? <EventCard score={feature} onPreview={() => setPreview(feature)} /> : <div className="live-empty"><p>Nenhum jogo disponÃ­vel agora.</p><span>A LAP continua acompanhando notÃ­cias e agenda.</span><Link href="/agenda">Abrir agenda completa</Link></div>}
          </div>

          <div className="live-experience__board">
            <div className="live-experience__board-heading"><div><p>Radar inteligente</p><h3>{favoritesOnly ? "Seus favoritos" : "Jogos para acompanhar"}</h3></div><span>{filtered.length} encontrados</span></div>
            {groups.length ? <div className="live-experience__groups">{groups.map((group) => <section key={group.league} className="live-experience__group"><header><h4>{group.league}</h4><span>{group.items.length}</span></header><div>{group.items.map((score) => <EventCard key={eventKey(score)} score={score} compact showSport onPreview={() => setPreview(score)} />)}</div></section>)}</div> : <div className="live-empty live-empty--board"><p>Nenhum jogo corresponde aos filtros.</p>{nextEvent ? <><span>PrÃ³ximo destaque disponÃ­vel:</span><EventCard score={nextEvent} compact onPreview={() => setPreview(nextEvent)} /></> : <span>A agenda serÃ¡ atualizada assim que novas partidas forem confirmadas.</span>}<button type="button" onClick={resetFilters}>Limpar filtros</button></div>}
          </div>
        </div>
      </section>

      <nav className="live-mobile-dock" aria-label="Atalhos da LAP"><a href="#central-ao-vivo">Ao vivo</a><a href="#agenda">Agenda</a><Link href="/favoritos">Favoritos</Link></nav>
      {preview && <PreviewDrawer score={preview} onClose={() => setPreview(null)} />}
    </>
  );
}