"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { curateHomepageNews } from "@/lib/home-news-curation";
import { SPORTS, type LivePayload, type NewsItem, type ScoreItem, type SportId } from "@/lib/live-data";
import { PUBLIC_SPORTS } from "@/lib/public-sports";
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

function updateTime(value?: string | null) {
  if (!value) return "agora";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "agora";
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function uniqueNews(items: NewsItem[]) {
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values());
}

function newsImage(item: NewsItem) {
  return item.imageUrl || "";
}

function newsAlt(item: NewsItem) {
  return item.imageAlt || item.title;
}

function sportName(id: SportId) {
  return SPORTS.find((sport) => sport.id === id)?.name || id;
}

function isResultBrief(item: NewsItem) {
  return item.source === "LAP · Resultado rápido";
}

function Visual({ item, eager = false, sizes }: { item: NewsItem; eager?: boolean; sizes: string }) {
  return (
    <Image
      src={newsImage(item)}
      alt={newsAlt(item)}
      fill
      priority={eager}
      sizes={sizes}
      className={styles.storyImage}
    />
  );
}

function MetaLine({ item, light = false }: { item: NewsItem; light?: boolean }) {
  return (
    <div className={`${styles.metaLine} ${light ? styles.metaLineLight : ""}`}>
      <span className={styles.sportPill}>{sportName(item.sportId as SportId)}</span>
      <span>{isResultBrief(item) ? "Placar confirmado" : item.source || "LAP"}</span>
      <span aria-hidden>•</span>
      <span>{relativeTime(item.publishedAt)}</span>
    </div>
  );
}

function SideStory({ item }: { item: NewsItem }) {
  return (
    <Link href={item.internalUrl} className={styles.sideStory}>
      <Visual item={item} sizes="(max-width: 820px) 100vw, 34vw" />
      <div className={styles.cardShade} />
      <div className={styles.sideStoryCopy}>
        <MetaLine item={item} light />
        <h2>{item.title}</h2>
      </div>
    </Link>
  );
}

function LatestCard({ item }: { item: NewsItem }) {
  return (
    <Link href={item.internalUrl} className={styles.latestCard}>
      <div className={styles.latestVisual}>
        <Visual item={item} sizes="(max-width: 700px) 100vw, (max-width: 1050px) 50vw, 33vw" />
        {isResultBrief(item) ? <span className={styles.resultBadge}>Resultado</span> : null}
      </div>
      <div className={styles.latestCopy}>
        <MetaLine item={item} />
        <h3>{item.title}</h3>
        {item.excerpt ? <p>{item.excerpt}</p> : null}
        <span className={styles.readMore}>Ler matéria <b aria-hidden>→</b></span>
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
      .filter((item) => item.imageUrl && /^https:\/\//i.test(item.imageUrl))
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
  const sideStories = curated.slice(1, 3);
  const used = new Set([lead, ...sideStories].filter(Boolean).map((item) => item!.slug || item!.id));
  const latest = curated.filter((item) => !used.has(item.slug || item.id)).slice(0, 9);

  return <main id="main-content" tabIndex={-1} data-lap-shell="editorial-v7">
    <LapHeader activeSport="todos" />

    <div className={`${styles.updateBar} ${failed ? styles.updateBarWarning : ""}`}>
      <div className={styles.shell}>
        <span className={styles.statusDot} aria-hidden />
        <strong>{failed ? "Tentando reconectar" : "Atualização automática ativa"}</strong>
        <span>Última carga: {updateTime(payload?.generatedAt)}</span>
        <Link href="/ao-vivo">Ver placares ao vivo →</Link>
      </div>
    </div>

    {lead ? <section className={`${styles.topStories} ${styles.shell}`} aria-label="Notícias em destaque">
      <Link href={lead.internalUrl} className={styles.leadStory}>
        <Visual item={lead} eager sizes="(max-width: 820px) 100vw, 66vw" />
        <div className={styles.leadShade} />
        <div className={styles.leadCopy}>
          <MetaLine item={lead} light />
          <h1>{lead.title}</h1>
          {lead.excerpt ? <p>{lead.excerpt}</p> : null}
          <span className={styles.leadAction}>Ler destaque <b aria-hidden>→</b></span>
        </div>
      </Link>
      <div className={styles.sideStack}>{sideStories.map((item) => <SideStory key={item.id} item={item} />)}</div>
    </section> : failed ? <section className={styles.notice}>A atualização editorial está temporariamente indisponível.</section> : <section className={`${styles.heroSkeleton} ${styles.shell}`} />}

    {events.length ? <section className={styles.liveSection}>
      <div className={`${styles.sectionBarDark} ${styles.shell}`}><div><p>Ao vivo e próximos</p><h2>O esporte não para</h2></div><Link href="/ao-vivo">Abrir central ao vivo</Link></div>
      <div className={`${styles.eventsGrid} ${styles.shell}`}>{events.map((event: ScoreItem) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact showSport />)}</div>
    </section> : null}

    {latest.length ? <section className={styles.latestSection}>
      <div className={`${styles.sectionBar} ${styles.shell}`}><div><p>Últimas notícias</p><h2>Atualizações que acabaram de chegar</h2><span>A LAP organiza resultados e notícias por ordem de publicação.</span></div><Link href="/agenda">Ver agenda</Link></div>
      <div className={`${styles.latestGrid} ${styles.shell}`}>{latest.map((item) => <LatestCard key={item.id} item={item} />)}</div>
    </section> : null}

    <section className={styles.sportsSection}>
      <div className={`${styles.sectionBar} ${styles.shell}`}><div><p>Modalidades</p><h2>Escolha seu esporte</h2></div></div>
      <nav className={`${styles.sportGrid} ${styles.shell}`} aria-label="Modalidades da LAP">{PUBLIC_SPORTS.map((sport) => {
        const latestForSport = allNews.find((item) => item.sportId === sport.id && item.imageUrl);
        return <Link key={sport.id} href={`/modalidades/${sport.id}`} className={styles.sportTile}>{latestForSport?.imageUrl ? <Image src={latestForSport.imageUrl} alt={latestForSport.imageAlt || latestForSport.title} fill sizes="(max-width: 640px) 50vw, (max-width: 1000px) 33vw, 20vw" /> : null}<div><span>{sport.icon}</span><h3>{sport.name}</h3><p>Ver cobertura →</p></div></Link>;
      })}</nav>
    </section>

    <footer className={styles.footer}>
      <div className={`${styles.footerGrid} ${styles.shell}`}>
        <div className={styles.footerIntro}><strong>LAP</strong><p>Notícias, agenda e resultados com uma experiência editorial limpa, visual e direta.</p></div>
        <div><h4>Cobertura</h4>{PUBLIC_SPORTS.slice(0, 4).map((sport) => <Link key={sport.id} href={`/modalidades/${sport.id}`}>{sport.name}</Link>)}</div>
        <div><h4>Mais esportes</h4>{PUBLIC_SPORTS.slice(4).map((sport) => <Link key={sport.id} href={`/modalidades/${sport.id}`}>{sport.name}</Link>)}</div>
        <div><h4>Acompanhe</h4><Link href="/ao-vivo">Ao vivo</Link><Link href="/agenda">Agenda</Link><Link href="/favoritos">Favoritos</Link><Link href="/college-football">College Football</Link></div>
      </div>
    </footer>
  </main>;
}
