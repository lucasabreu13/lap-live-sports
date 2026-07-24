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

function Visual({ item, eager = false }: { item: NewsItem; eager?: boolean }) {
  if (isResultBrief(item)) return <ResultBriefVisual title={item.title} sportId={item.sportId as SportId} />;
  return <img src={newsImage(item)} alt={newsAlt(item)} loading={eager ? "eager" : "lazy"} />;
}

function CategoryTile({ item }: { item: NewsItem }) {
  return (
    <Link href={item.internalUrl} className={styles.categoryTile}>
      <Visual item={item} />
      <div>
        <p>{sportName(item.sportId as SportId)} · {relativeTime(item.publishedAt)}</p>
        <h3>{item.title}</h3>
        <span>Ler matéria</span>
      </div>
    </Link>
  );
}

function RailCard({ item }: { item: NewsItem }) {
  return (
    <Link href={item.internalUrl} className={styles.railCard}>
      <div className={styles.railVisual}><Visual item={item} /></div>
      <div className={styles.railCopy}><p>{sportName(item.sportId as SportId)} · {relativeTime(item.publishedAt)}</p><h3>{item.title}</h3></div>
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
    const unique = Array.from(new Map(payload.feeds.flatMap((feed) => feed.scores).map((event) => [`${event.sportId}:${event.id}`, event])).values());
    return unique.filter((event) => event.state === "in" || event.state === "pre").sort((a, b) => {
      if (a.state === "in" && b.state !== "in") return -1;
      if (b.state === "in" && a.state !== "in") return 1;
      return new Date(a.startTime || 0).getTime() - new Date(b.startTime || 0).getTime();
    }).slice(0, 6);
  }, [payload]);

  const lead = curated[0] || null;
  const categoryStories = curated.slice(1, 5);
  const used = new Set([lead, ...categoryStories].filter(Boolean).map((item) => item!.slug || item!.id));
  const latest = allNews.filter((item) => !used.has(item.slug || item.id)).slice(0, 12);

  return <main id="main-content" tabIndex={-1} data-lap-shell="editorial-v5">
    <LapHeader activeSport="todos" />

    {lead ? <section className={styles.hero} aria-label="Principal notícia">
      <Visual item={lead} eager />
      <div className={styles.heroShade} />
      <div className={styles.heroCopy}>
        <p>{sportName(lead.sportId as SportId)} · {relativeTime(lead.publishedAt)}</p>
        <h1>{lead.title}</h1>
        {lead.excerpt ? <span>{lead.excerpt}</span> : null}
        <Link href={lead.internalUrl}>Ler matéria</Link>
      </div>
    </section> : failed ? <section className={styles.notice}>A atualização editorial está temporariamente indisponível.</section> : <section className={styles.heroSkeleton} />}

    {categoryStories.length ? <section className={styles.categoryGrid} aria-label="Destaques editoriais">{categoryStories.map((item) => <CategoryTile key={item.id} item={item} />)}</section> : null}

    {latest.length ? <section className={styles.railSection}>
      <div className={styles.sectionBar}><div><p>Novidades</p><h2>O que está movimentando o esporte</h2></div><Link href="/agenda">Ver agenda</Link></div>
      <div className={styles.rail}>{latest.map((item) => <RailCard key={item.id} item={item} />)}</div>
    </section> : null}

    <section className={styles.sportsSection}>
      <div className={styles.sectionBar}><div><p>Modalidades</p><h2>Explore por esporte</h2></div></div>
      <nav className={styles.sportRail} aria-label="Modalidades da LAP">{PUBLIC_SPORTS.map((sport) => {
        const visual = sportCoverImage(sport.id);
        return <Link key={sport.id} href={`/modalidades/${sport.id}`} className={styles.sportTile}><img src={visual.image} alt={visual.alt} loading="lazy" /><div><p>Modalidade</p><h3>{sport.name}</h3><span>Ver cobertura</span></div></Link>;
      })}</nav>
    </section>

    {events.length ? <section className={styles.darkSection}>
      <div className={styles.sectionBarDark}><div><p>Ao vivo e próximos</p><h2>O esporte não para</h2></div><Link href="/ao-vivo">Abrir central ao vivo</Link></div>
      <div className={styles.eventsGrid}>{events.map((event: ScoreItem) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact showSport />)}</div>
    </section> : null}

    <footer className={styles.footer}>
      <div className={styles.footerGrid}>
        <div className={styles.footerIntro}><strong>LAP</strong><p>Notícias, agenda e resultados com uma experiência editorial limpa, visual e direta.</p></div>
        <div><h4>Cobertura</h4>{PUBLIC_SPORTS.slice(0, 4).map((sport) => <Link key={sport.id} href={`/modalidades/${sport.id}`}>{sport.name}</Link>)}</div>
        <div><h4>Mais esportes</h4>{PUBLIC_SPORTS.slice(4).map((sport) => <Link key={sport.id} href={`/modalidades/${sport.id}`}>{sport.name}</Link>)}</div>
        <div><h4>Acompanhe</h4><Link href="/ao-vivo">Ao vivo</Link><Link href="/agenda">Agenda</Link><Link href="/favoritos">Favoritos</Link><Link href="/college-football">College Football</Link></div>
      </div>
    </footer>
  </main>;
}