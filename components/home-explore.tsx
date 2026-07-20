"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { eventHref } from "@/lib/event-presentation";
import { eventDisplayTitle, isHeadToHeadEvent, isSingleEvent } from "@/lib/event-presentation";
import { FOOTBALL_COMPETITIONS, SPORTS, type LivePayload, type NewsItem, type ScoreItem, type SportId } from "@/lib/live-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./home-explore.module.css";

type PollChoice = "home" | "draw" | "away";

const specialItems = [
  { href: "/agenda", icon: "▦", title: "Jogos imperdíveis", text: "Agenda filtrada por hoje, amanhã, favoritos e modalidade." },
  { href: "/copa-2026", icon: "🏆", title: "Copa 2026", text: "Central com jogos, chaveamento e cobertura da Copa." },
  { href: "/college-football", icon: "🏈", title: "College Football", text: "FBS, FCS, DII e DIII com times, jogos, elencos, estádios e títulos." },
  { href: "/cobertura", icon: "◎", title: "Mapa de cobertura", text: "Veja o que cada modalidade entrega na LAP." },
  { href: "/favoritos", icon: "★", title: "Minha LAP", text: "Salve times, ligas e eventos para acompanhar melhor." },
];

function eventKey(score: ScoreItem) {
  return `${score.sportId}:${score.id}:${score.isWorldCup ? "cup" : "main"}`;
}

function eventTime(score: ScoreItem) {
  if (!score.startTime) return Number.MAX_SAFE_INTEGER;
  const time = new Date(score.startTime).getTime();
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

function uniqueEvents(payload: LivePayload | null) {
  if (!payload) return [];
  const events = [...payload.worldCup.events, ...payload.feeds.flatMap((feed) => feed.scores)];
  return Array.from(new Map(events.map((event) => [eventKey(event), event])).values());
}

function sortEvents(events: ScoreItem[]) {
  return [...events].sort((a, b) => {
    const phase = (score: ScoreItem) => score.state === "in" ? 0 : score.state === "pre" ? 1 : 2;
    const phaseDiff = phase(a) - phase(b);
    if (phaseDiff) return phaseDiff;
    if (a.state === "post" || b.state === "post") return eventTime(b) - eventTime(a);
    return eventTime(a) - eventTime(b);
  });
}

function formatDate(value: string | null) {
  if (!value) return "Horário a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function sportMeta(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId);
}

function compactSource(item: NewsItem) {
  return item.kind === "editorial" ? "LAP" : item.source;
}

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [`${item.sportId}:${item.slug}`, item])).values());
}

function balancedNews(payload: LivePayload) {
  const newsroom = payload.editorial.filter((item) => item.source !== "LAP Guia");
  const guides = payload.editorial.filter((item) => item.source === "LAP Guia");
  const pool = uniqueNews([...newsroom, ...payload.feeds.flatMap((feed) => feed.news), ...guides]);
  const grouped = new Map(SPORTS.map((sport) => [sport.id, pool.filter((item) => item.sportId === sport.id)]));
  const ordered: NewsItem[] = [];
  for (let round = 0; round < 4; round += 1) {
    for (const sport of SPORTS) {
      const item = grouped.get(sport.id)?.[round];
      if (item) ordered.push(item);
    }
  }
  return ordered;
}

function competitionCount(events: ScoreItem[], competitionId: string, name: string) {
  const normalized = name.toLocaleLowerCase("pt-BR");
  return events.filter((event) => event.competitionId === competitionId || event.league.toLocaleLowerCase("pt-BR").includes(normalized)).length;
}

function countryGroups(events: ScoreItem[]) {
  const groups = new Map<string, number>();
  for (const event of events.filter((item) => item.sportId === "futebol")) {
    const country = event.country || "Internacional";
    groups.set(country, (groups.get(country) ?? 0) + 1);
  }
  return [...groups.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([country, count]) => ({ country, count }));
}

function matchTitle(event: ScoreItem) {
  return eventDisplayTitle(event);
}

function FeaturedMatch({ event }: { event: ScoreItem | null }) {
  if (!event) {
    return <div className={styles.empty}>Os próximos eventos confirmados aparecerão aqui.</div>;
  }

  return (
    <Link className={styles.matchHero} href={eventHref(event)}>
      <p className={styles.matchMeta}>{event.state === "in" ? "Ao vivo agora" : event.state === "post" ? "Último resultado" : "Próximo destaque"}</p>
      <h3>{isSingleEvent(event) ? event.home.name : <>{event.home.name} <span>×</span> {event.away.name}</>}</h3>
      <div className={styles.matchHeroFooter}>
        <div>
          <strong>{event.league.replace(/-/g, " ")}</strong>
          {event.state === "post" ? event.status : formatDate(event.startTime)}
        </div>
        <span>Acompanhar →</span>
      </div>
    </Link>
  );
}

function PollCard({ event }: { event: ScoreItem }) {
  const [choice, setChoice] = useState<PollChoice | null>(null);
  if (!isHeadToHeadEvent(event)) return null;
  return (
    <article className={styles.pollCard}>
      <p className={styles.pollKicker}>Quem vence?</p>
      <strong>{event.home.name} x {event.away.name}</strong>
      <span>{event.league.replace(/-/g, " ")} · {formatDate(event.startTime)}</span>
      <div className={styles.pollOptions}>
        <button type="button" className={choice === "home" ? styles.active : ""} onClick={() => setChoice("home")}>{event.home.name.split(" ")[0]}</button>
        <button type="button" className={choice === "draw" ? styles.active : ""} onClick={() => setChoice("draw")}>Empate</button>
        <button type="button" className={choice === "away" ? styles.active : ""} onClick={() => setChoice("away")}>{event.away.name.split(" ")[0]}</button>
      </div>
    </article>
  );
}

export function HomeExplore({ payload, mode }: { payload: LivePayload | null; mode: "lead" | "more" }) {
  const events = useMemo(() => sortEvents(uniqueEvents(payload)), [payload]);
  const sports = useMemo(() => SPORTS.map((sport) => ({ sport, count: events.filter((event) => event.sportId === sport.id).length })), [events]);
  const featured = events[0] ?? null;
  const sideEvents = events.filter((event) => featured ? eventKey(event) !== eventKey(featured) : true).slice(0, 4);
  const allNews = useMemo(() => payload ? balancedNews(payload) : [], [payload]);
  const newsBySport = useMemo(() => new Map(SPORTS.map((sport) => [sport.id, allNews.filter((item) => item.sportId === sport.id).slice(0, 2)])), [allNews]);
  const popularCompetitions = useMemo(() => FOOTBALL_COMPETITIONS
    .map((competition) => ({ ...competition, count: competitionCount(events, competition.id, competition.name) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8), [events]);
  const countries = useMemo(() => countryGroups(events), [events]);
  const pollEvents = events.filter((event) => isHeadToHeadEvent(event) && event.state !== "post").slice(0, 3);

  return (
    <section className={`${styles.portal} ${mode === "lead" ? styles.portalLead : styles.portalMore}`} aria-labelledby={mode === "lead" ? "portal-home-title" : undefined}>
      {mode === "lead" && <header className={styles.header}>
        <div>
          <p>Portal LAP</p>
          <h2 id="portal-home-title">Tudo que importa no dia esportivo</h2>
          <span>Jogos, modalidades, campeonatos, países, notícias e interação em uma experiência mais parecida com app esportivo.</span>
        </div>
        <Link href="/agenda" className={styles.portalLink}>Abrir agenda completa</Link>
      </header>}

      {mode === "lead" && <nav className={styles.coverageRail} aria-label="Cobertura por modalidade">
        {SPORTS.map((sport) => <Link href={`/modalidades/${sport.id}`} key={sport.id}><span aria-hidden>{sport.icon}</span>{sport.name}</Link>)}
      </nav>}

      {mode === "more" && <div className={styles.productGrid}>
        <aside className={styles.panel} aria-label="Modalidades em destaque">
          <div className={styles.sectionTitle}><p>Esportes</p><h2>Modalidades</h2><span>Entre rápido no esporte que você quer acompanhar.</span></div>
          <div className={styles.sportList}>
            {sports.length ? sports.map(({ sport, count }) => (
              <Link key={sport.id} href={`/modalidades/${sport.id}`} className={styles.sportPill}>
                <span className={styles.sportPillIcon} aria-hidden>{sport.icon}</span>
                <span><strong>{sport.name}</strong><small>{sport.description || "Notícias, jogos e resultados"}</small></span>
                <em>{count}</em>
              </Link>
            )) : SPORTS.slice(0, 6).map((sport) => (
              <Link key={sport.id} href={`/modalidades/${sport.id}`} className={styles.sportPill}>
                <span className={styles.sportPillIcon} aria-hidden>{sport.icon}</span>
                <span><strong>{sport.name}</strong><small>{sport.description || "Notícias, jogos e resultados"}</small></span>
                <em>→</em>
              </Link>
            ))}
          </div>
        </aside>

        <section className={styles.panel} aria-label="Jogos em destaque">
          <div className={styles.sectionTitle}><p>Jogos</p><h2>Agora na LAP</h2><span>O principal evento e uma lista curta para leitura rápida.</span></div>
          <div className={styles.matchStack}>
            <FeaturedMatch event={featured} />
            <div className={styles.eventGrid}>
              {sideEvents.length ? sideEvents.map((event) => <EventCard key={eventKey(event)} score={event} compact showSport />) : <div className={styles.empty}>Nenhum evento em destaque neste momento.</div>}
            </div>
          </div>
        </section>

        <aside className={styles.panel} aria-label="Últimas notícias">
          <div className={styles.sectionTitle}><p>Notícias</p><h2>Últimas</h2><span>Resumo rápido por modalidade, sem sair da LAP.</span></div>
          <div className={styles.newsStack}>
            {allNews.length ? allNews.slice(0, 6).map((item) => (
              <Link key={item.id} href={item.internalUrl} className={styles.storyCard}>
                <img className={styles.storyImage} src={item.imageUrl || sportCoverImage(item.sportId).image} alt={item.imageAlt || sportCoverImage(item.sportId).alt} loading="lazy" />
                <span>
                  <p className={styles.storyMeta}>{compactSource(item)}</p>
                  <strong>{item.title}</strong>
                  <small>{sportMeta(item.sportId as SportId)?.name ?? item.sportId}</small>
                </span>
              </Link>
            )) : <div className={styles.empty}>As notícias mais recentes aparecem aqui assim que forem publicadas.</div>}
          </div>
        </aside>
      </div>}

      {mode === "lead" && <section className={`${styles.panel} ${styles.newsroom}`} aria-label="Principais notícias das modalidades">
        <div className={styles.sectionTitle}><p>Redação multimodalidade</p><h2>Principais notícias</h2><span>Uma manchete de cada esporte primeiro; novas histórias entram sem apagar a cobertura das outras modalidades.</span></div>
        {allNews.length ? <>
          <div className={styles.headlineGrid}>
            {allNews.slice(0, 5).map((item, index) => (
              <Link href={item.internalUrl} className={`${styles.headlineCard} ${index === 0 ? styles.headlineLead : ""}`} key={`${item.id}-headline`}>
                <img src={item.imageUrl || sportCoverImage(item.sportId).image} alt={item.imageAlt || sportCoverImage(item.sportId).alt} loading={index === 0 ? "eager" : "lazy"} />
                <span className={styles.headlineBody}>
                  <small>{sportMeta(item.sportId)?.name} · {compactSource(item)}</small>
                  <strong>{item.title}</strong>
                  <em>{item.excerpt}</em>
                </span>
              </Link>
            ))}
          </div>
          <div className={styles.modalityNewsGrid}>
            {SPORTS.map((sport) => {
              const lead = (newsBySport.get(sport.id) ?? [])[0];
              const visual = sportCoverImage(sport.id);
              return (
                <article className={styles.modalityNews} key={sport.id}>
                  <img src={lead?.imageUrl || visual.image} alt={lead?.imageAlt || visual.alt} loading="lazy" />
                  <div>
                    <p>{sport.icon} {sport.name}</p>
                    <strong>{lead?.title || `Cobertura de ${sport.name} na LAP`}</strong>
                    <span>{lead?.excerpt || sport.description || "Agenda, notícias e contexto da modalidade em um só lugar."}</span>
                    <nav aria-label={`Notícias de ${sport.name}`}>
                      {lead ? <Link href={lead.internalUrl}>Ler destaque</Link> : null}
                      <Link href={`/modalidades/${sport.id}`}>Abrir central</Link>
                    </nav>
                  </div>
                </article>
              );
            })}
          </div>
        </> : <div className={styles.empty}>As manchetes serão exibidas assim que a atualização de notícias estiver disponível.</div>}
      </section>}

      {mode === "more" && <section className={styles.panel} aria-label="Campeonatos em destaque">
        <div className={styles.sectionTitle}><p>Campeonatos populares</p><h2>Ligas em destaque</h2><span>Atalhos para as competições que mais ajudam o usuário a navegar.</span></div>
        <div className={styles.leagueGrid}>
          {popularCompetitions.map((competition) => (
            <Link href={`/campeonatos/${competition.id}`} className={styles.leagueCard} key={competition.id}>
              <span className={styles.cardIcon} aria-hidden>🏟️</span>
              <strong>{competition.name}</strong>
              <span>{competition.country} · {competition.count === 1 ? "1 evento" : `${competition.count} eventos`}</span>
            </Link>
          ))}
        </div>
      </section>}

      {mode === "more" && <section className={styles.panel} aria-label="Jogos por país">
        <div className={styles.sectionTitle}><p>Futebol por país</p><h2>Navegação rápida</h2><span>Agrupe a agenda por país para reduzir lista infinita e achar jogos mais rápido.</span></div>
        <div className={styles.countryGrid}>
          {countries.length ? countries.map((item) => (
            <Link href={`/agenda?pais=${encodeURIComponent(item.country)}`} className={styles.countryCard} key={item.country}>
              <span className={styles.cardIcon} aria-hidden>🌎</span>
              <strong>{item.country}</strong>
              <span>{item.count === 1 ? "1 jogo" : `${item.count} jogos`} no radar</span>
            </Link>
          )) : <div className={styles.empty}>Os países aparecem quando houver jogos de futebol disponíveis na agenda.</div>}
        </div>
      </section>}

      {mode === "more" && <section className={styles.panel} aria-label="Interação e especiais">
        <div className={styles.sectionTitle}><p>Retenção</p><h2>Interação e especiais</h2><span>Blocos simples para o usuário continuar navegando, sem depender de apostas.</span></div>
        {pollEvents.length ? <div className={styles.pollGrid}>{pollEvents.map((event) => <PollCard key={eventKey(event)} event={event} />)}</div> : null}
        <div className={styles.specialGrid} style={{ marginTop: pollEvents.length ? 14 : 0 }}>
          {specialItems.map((item) => (
            <Link href={item.href} className={styles.specialCard} key={item.href}>
              <span className={styles.cardIcon} aria-hidden>{item.icon}</span>
              <strong>{item.title}</strong>
              <span>{item.text}</span>
            </Link>
          ))}
        </div>
      </section>}
    </section>
  );
}
