"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { ResultBriefVisual } from "@/components/result-brief-visual";
import { curateHomepageNews } from "@/lib/home-news-curation";
import { SPORTS, type LivePayload, type NewsItem, type ScoreItem, type SportId } from "@/lib/live-data";
import { PUBLIC_SPORTS } from "@/lib/public-sports";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./editorial-home.module.css";

function relativeTime(value: string | null) {
  if (!value) return "Agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Agora";
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "Agora";
  if (minutes < 60) return `Há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Há ${hours}h`;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "America/Sao_Paulo" }).format(date);
}

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values());
}

function newsImage(item: NewsItem) {
  return item.imageUrl || sportCoverImage(item.sportId).image;
}

function newsAlt(item: NewsItem) {
  return item.imageAlt || item.title || sportCoverImage(item.sportId).alt;
}

function sportName(id: SportId) {
  return SPORTS.find((sport) => sport.id === id)?.name || id;
}

function isResultBrief(item: NewsItem) {
  return item.source === "LAP · Resultado rápido";
}

function StoryVisual({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  if (isResultBrief(item)) return <ResultBriefVisual title={item.title} sportId={item.sportId as SportId} compact={compact} />;
  return <img src={newsImage(item)} alt={newsAlt(item)} loading="lazy" />;
}

function StoryCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <Link href={item.internalUrl} className={compact ? styles.storyCompact : styles.storyCard}>
      <StoryVisual item={item} compact={compact} />
      <div>
        <p>{isResultBrief(item) ? "Resultado rápido · " : ""}{sportName(item.sportId as SportId)} · {relativeTime(item.publishedAt)}</p>
        <h3>{item.title}</h3>
        {!compact && item.excerpt ? <span>{item.excerpt}</span> : null}
      </div>
    </Link>
  );
}

export function EditorialHome({ initialPayload = null }: { initialPayload?: LivePayload | null }) {
  const [payload, setPayload] = useState<LivePayload | null>(initialPayload);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let timer = 0;
    const schedule = (next: LivePayload | null) => {
      const hasLive = Boolean(next?.feeds.some((feed) => feed.scores.some((score) => score.state === "in")));
      timer = window.setTimeout(load, hasLive ? 15_000 : 120_000);
    };
    const load = async () => {
      try {
        const response = await fetch("/api/live");
        if (!response.ok) throw new Error("Falha ao carregar");
        const next = await response.json() as LivePayload;
        if (active) { setPayload(next); setFailed(false); schedule(next); }
      } catch {
        if (active) { setFailed(true); schedule(payload); }
      }
    };
    if (initialPayload) schedule(initialPayload); else void load();
    return () => { active = false; window.clearTimeout(timer); };
  }, []);

  const allNews = useMemo(() => {
    if (!payload) return [];
    return uniqueNews([...payload.editorial, ...payload.feeds.flatMap((feed) => feed.news)])
      .filter((item) => item.kind === "editorial")
      .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
  }, [payload]);

  const curated = useMemo(() => curateHomepageNews(allNews), [allNews]);

  const events = useMemo(() => {
    if (!payload) return [];
    const all = payload.feeds.flatMap((feed) => feed.scores);
    const unique = Array.from(new Map(all.map((event) => [`${event.sportId}:${event.id}`, event])).values());
    return unique.filter((event) => event.state === "in" || event.state === "pre").sort((a, b) => {
      if (a.state === "in" && b.state !== "in") return -1;
      if (b.state === "in" && a.state !== "in") return 1;
      return new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime();
    }).slice(0, 6);
  }, [payload]);

  const lead = curated[0] || null;
  const secondary = curated.slice(1, 5);
  const heroIds = new Set([lead, ...secondary].filter(Boolean).map((item) => item!.slug || item!.id));
  const latest = allNews.filter((item) => !heroIds.has(item.slug || item.id)).slice(0, 8);

  return (
    <main id="main-content" tabIndex={-1} data-lap-shell="editorial-v3">
      <LapHeader activeSport="todos" />
      <div className={`shell ${styles.page}`}>
        <header className={styles.masthead}><div><p>Redação LAP · atualização contínua</p><h1>O esporte começa pelas histórias que realmente importam.</h1></div><Link href="/agenda">Ver agenda completa →</Link></header>

        {curated.length ? <section className={styles.hero} aria-label="Principais notícias">
          {lead ? <Link href={lead.internalUrl} className={styles.lead}>{isResultBrief(lead) ? <ResultBriefVisual title={lead.title} sportId={lead.sportId as SportId} /> : <img src={newsImage(lead)} alt={newsAlt(lead)} loading="eager" />}<div><p>{isResultBrief(lead) ? "Resultado rápido · " : ""}{sportName(lead.sportId as SportId)} · {relativeTime(lead.publishedAt)}</p><h2>{lead.title}</h2>{lead.excerpt ? <span>{lead.excerpt}</span> : null}<strong>Ler {isResultBrief(lead) ? "resultado" : "matéria"} →</strong></div></Link> : null}
          <div className={styles.secondaryGrid}>{secondary.map((item) => <StoryCard key={item.id} item={item} compact />)}</div>
        </section> : failed ? <section className={styles.notice}>A atualização editorial está temporariamente indisponível. A LAP tentará novamente automaticamente.</section> : <section className={styles.heroSkeleton} aria-label="Carregando notícias"><span /><span /><span /></section>}

        {latest.length ? <section className={styles.section}><div className={styles.sectionHeading}><div><p>Últimas notícias</p><h2>Publicadas agora</h2></div><span>Ordem cronológica, separada da curadoria de destaques.</span></div><div className={styles.latestGrid}>{latest.map((item) => <StoryCard key={item.id} item={item} />)}</div></section> : null}

        {events.length ? <section className={styles.section}><div className={styles.sectionHeading}><div><p>Ao vivo e próximos</p><h2>Agenda em movimento</h2></div><Link href="/agenda">Abrir agenda →</Link></div><div className={styles.eventsGrid}>{events.map((event: ScoreItem) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact showSport />)}</div></section> : null}

        <section className={styles.section}><div className={styles.sectionHeading}><div><p>Modalidades</p><h2>Entre direto em toda a cobertura</h2></div><span>Todas as modalidades ativas da LAP ficam acessíveis aqui.</span></div><nav className={styles.sportsGrid} aria-label="Todas as modalidades da LAP">{PUBLIC_SPORTS.map((sport) => {
          const count = allNews.filter((item) => item.sportId === sport.id).length;
          const feed = payload?.feeds.find((item) => item.id === sport.id);
          const hasAgenda = Boolean(feed?.scores.length);
          return <Link key={sport.id} href={`/modalidades/${sport.id}`}><span>{sport.icon}</span><div><strong>{sport.name}</strong>{count ? <small>{count} notícia{count === 1 ? "" : "s"}</small> : hasAgenda ? <small>Agenda disponível</small> : null}</div><em>→</em></Link>;
        })}</nav></section>
      </div>
      <footer className={styles.footer}><div className="shell"><strong>LAP Live Sports</strong><span>Notícias autorais, agenda e resultados em uma experiência editorial própria.</span></div></footer>
    </main>
  );
}
