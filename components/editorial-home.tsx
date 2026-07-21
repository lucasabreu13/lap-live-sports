"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
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

function StoryCard({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <Link href={item.internalUrl} className={compact ? styles.storyCompact : styles.storyCard}>
      <img src={newsImage(item)} alt={newsAlt(item)} loading="lazy" />
      <div>
        <p>{sportName(item.sportId as SportId)} · {relativeTime(item.publishedAt)}</p>
        <h3>{item.title}</h3>
        {!compact && item.excerpt ? <span>{item.excerpt}</span> : null}
      </div>
    </Link>
  );
}

export function EditorialHome() {
  const [payload, setPayload] = useState<LivePayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/live");
        if (!response.ok) throw new Error("Falha ao carregar");
        const next = await response.json() as LivePayload;
        if (active) { setPayload(next); setFailed(false); }
      } catch { if (active) setFailed(true); }
    };
    void load();
    const timer = window.setInterval(load, 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const news = useMemo(() => {
    if (!payload) return [];
    const originalOrder = uniqueNews([...payload.editorial, ...payload.feeds.flatMap((feed) => feed.news)]).filter((item) => item.kind === "editorial");
    return curateHomepageNews(originalOrder);
  }, [payload]);

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

  const lead = news[0] || null;
  const secondary = news.slice(1, 5);
  const latest = news.slice(5, 13);

  return (
    <main id="main-content" tabIndex={-1}>
      <LapHeader activeSport="todos" />
      <div className={`shell ${styles.page}`}>
        <header className={styles.masthead}><div><p>Redação LAP · atualização contínua</p><h1>O esporte começa pelas histórias que realmente importam.</h1></div><Link href="/agenda">Ver agenda completa →</Link></header>

        {news.length ? <section className={styles.hero} aria-label="Principais notícias">
          {lead ? <Link href={lead.internalUrl} className={styles.lead}><img src={newsImage(lead)} alt={newsAlt(lead)} loading="eager" /><div><p>{sportName(lead.sportId as SportId)} · {relativeTime(lead.publishedAt)}</p><h2>{lead.title}</h2>{lead.excerpt ? <span>{lead.excerpt}</span> : null}<strong>Ler matéria →</strong></div></Link> : null}
          <div className={styles.secondaryGrid}>{secondary.map((item) => <StoryCard key={item.id} item={item} compact />)}</div>
        </section> : failed ? <section className={styles.notice}>A atualização editorial está temporariamente indisponível. A LAP tentará novamente automaticamente.</section> : <section className={styles.heroSkeleton} aria-label="Carregando notícias"><span /><span /><span /></section>}

        {latest.length ? <section className={styles.section}><div className={styles.sectionHeading}><div><p>Últimas notícias</p><h2>Agora na LAP</h2></div><span>Conteúdo autoral organizado por relevância, atualidade e variedade de modalidades.</span></div><div className={styles.latestGrid}>{latest.map((item) => <StoryCard key={item.id} item={item} />)}</div></section> : null}

        {events.length ? <section className={styles.section}><div className={styles.sectionHeading}><div><p>Ao vivo e próximos</p><h2>Agenda em movimento</h2></div><Link href="/agenda">Abrir agenda →</Link></div><div className={styles.eventsGrid}>{events.map((event: ScoreItem) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact showSport />)}</div></section> : null}

        <section className={styles.section}><div className={styles.sectionHeading}><div><p>Modalidades</p><h2>Entre direto em toda a cobertura</h2></div><span>Todas as modalidades ativas da LAP ficam acessíveis aqui.</span></div><nav className={styles.sportsGrid} aria-label="Todas as modalidades da LAP">{PUBLIC_SPORTS.map((sport) => {
          const count = news.filter((item) => item.sportId === sport.id).length;
          const feed = payload?.feeds.find((item) => item.id === sport.id);
          const hasAgenda = Boolean(feed?.scores.length);
          return <Link key={sport.id} href={`/modalidades/${sport.id}`}><span>{sport.icon}</span><div><strong>{sport.name}</strong>{count ? <small>{count} notícia{count === 1 ? "" : "s"}</small> : hasAgenda ? <small>Agenda disponível</small> : null}</div><em>→</em></Link>;
        })}</nav></section>
      </div>
      <footer className={styles.footer}><div className="shell"><strong>LAP Live Sports</strong><span>Notícias autorais, agenda e resultados em uma experiência editorial própria.</span></div></footer>
    </main>
  );
}
