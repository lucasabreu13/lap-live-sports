import type { ReactNode } from "react";
import Link from "next/link";
import { EventCard, eventHref } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { StandingGroups } from "@/components/sport-hubs/standing-groups";
import type { EspnCalendarItem } from "@/lib/providers/espn-provider";
import type { ScoreItem } from "@/lib/live-data";
import type { SportHubDetails, SportHubEntity, SportHubGuideItem } from "@/lib/sport-hubs/types";
import styles from "./sport-hub-center.module.css";

function formatDate(value: string | null) {
  if (!value) return "Horário em atualização";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Horário em atualização";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <header className={styles.sectionHead}><div><p>{eyebrow}</p><h2>{title}</h2><span>{description}</span></div>{action}</header>;
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

function EventGrid({ events, empty }: { events: ScoreItem[]; empty: string }) {
  return events.length
    ? <div className={styles.eventGrid}>{events.slice(0, 10).map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact />)}</div>
    : <EmptyState>{empty}</EmptyState>;
}

function CalendarList({ details }: { details: SportHubDetails }) {
  const items = [...details.calendar].sort((a, b) => {
    const time = (item: EspnCalendarItem) => item.startTime ? new Date(item.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    const phase = (item: EspnCalendarItem) => item.state === "in" ? 0 : item.state === "pre" ? 1 : item.state === "post" ? 2 : 3;
    const phaseDifference = phase(a) - phase(b);
    if (phaseDifference) return phaseDifference;
    return a.state === "post" ? time(b) - time(a) : time(a) - time(b);
  }).slice(0, details.config.layout === "race" ? 16 : 10);
  if (!items.length) return <EmptyState>Calendário em atualização. A LAP mantém o mapa da modalidade e as notícias disponíveis.</EmptyState>;
  return <div className={styles.calendarList}>{items.map((item) => <Link key={item.id} href={`/jogos/${details.sport.id}/${item.eventId}`}><span data-state={item.state}>{item.state === "in" ? "Agora" : item.state === "post" ? "Encerrado" : formatDate(item.startTime)}</span><strong>{item.title}</strong><small>{item.competition}{item.status ? ` · ${item.status}` : ""}</small></Link>)}</div>;
}

function EntityGrid({ entities }: { entities: SportHubEntity[] }) {
  return <div className={styles.entityGrid}>{entities.map((entity) => <article key={`${entity.category}-${entity.title}`}><span>{entity.category}</span><strong>{entity.title}</strong><p>{entity.description}</p></article>)}</div>;
}

function GuideGrid({ items }: { items: SportHubGuideItem[] }) {
  return <div className={styles.guideGrid}>{items.map((item) => <article key={item.title}><span>{item.value}</span><strong>{item.title}</strong><p>{item.description}</p></article>)}</div>;
}

function NewsSection({ details }: { details: SportHubDetails }) {
  return <section className={styles.section}><SectionHeader eyebrow={`Notícias de ${details.sport.name}`} title="Últimas histórias" description="Resumos e matérias abrem dentro da LAP, com crédito e contexto editorial." />{details.news.length ? <div className={styles.newsGrid}>{details.news.map((item) => <Link href={item.internalUrl} className={styles.newsCard} key={item.id}><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <EmptyState>As próximas notícias desta modalidade entram aqui assim que forem publicadas.</EmptyState>}</section>;
}

function RankingSection({ details }: { details: SportHubDetails }) {
  return <section className={styles.section}><SectionHeader eyebrow="Classificação" title={details.config.rankingTitle} description={details.config.rankingDescription} />{details.standings.length ? <StandingGroups groups={details.standings.slice(0, 8)} limit={details.config.layout === "race" ? 22 : 16} /> : <EmptyState><strong>Dados oficiais em atualização.</strong><span>A área fica pronta, mas nenhuma posição é preenchida sem um retorno confiável e atual.</span></EmptyState>}</section>;
}

function EntitySection({ details }: { details: SportHubDetails }) {
  return <section className={styles.section}><SectionHeader eyebrow="Mapa da modalidade" title={details.config.entityTitle} description={details.config.entityDescription} /><EntityGrid entities={details.config.entities} /></section>;
}

function CalendarSection({ details, title = "Calendário e eventos" }: { details: SportHubDetails; title?: string }) {
  return <section className={styles.section}><SectionHeader eyebrow="Calendário" title={title} description="Datas e horários aparecem no fuso de Brasília quando publicados." action={<Link href={`/agenda?sport=${details.sport.id}`} className={styles.action}>Agenda completa</Link>} /><CalendarList details={details} /></section>;
}

function EventsSection({ details, title, description }: { details: SportHubDetails; title: string; description: string }) {
  const events = [...details.live, ...details.upcoming, ...details.recent];
  return <section className={styles.section}><SectionHeader eyebrow="Agora" title={title} description={description} action={<Link href="/ao-vivo" className={styles.action}>Central Ao Vivo</Link>} /><EventGrid events={events} empty={details.config.emptyEventMessage} /></section>;
}

function HeroFocus({ details, featured }: { details: SportHubDetails; featured: ScoreItem | null }) {
  if (featured) return <div className={styles.heroFocus}><div><p>{featured.state === "in" ? "Em andamento" : featured.state === "pre" ? "Próximo evento" : "Resultado recente"}</p><h2>Destaque</h2></div><EventCard score={featured} /><Link href={eventHref(featured)} className={styles.heroLink}>Abrir evento</Link></div>;
  if (details.config.spotlight) return <div className={styles.heroFocus}><div><p>Destaque da temporada</p><h2>{details.config.spotlight.title}</h2><span>{details.config.spotlight.text}</span></div><Link href={`/agenda?sport=${details.sport.id}`} className={styles.heroLink}>Ver calendário</Link></div>;
  return <div className={styles.heroFocus}><div><p>{details.config.primaryCompetition}</p><h2>Entre eventos</h2><span>{details.config.emptyEventMessage}</span></div><Link href={`/agenda?sport=${details.sport.id}`} className={styles.heroLink}>Ver agenda</Link></div>;
}

function Hero({ details }: { details: SportHubDetails }) {
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;
  return <section className={styles.hero} data-layout={details.config.layout}><div className={styles.heroMain}><p className={styles.kicker}>{details.config.eyebrow}</p><h1>{details.config.title}</h1><span>{details.config.subtitle}</span><div className={styles.metrics}><article><p>Ao vivo</p><strong>{details.live.length}</strong><span>agora</span></article><article><p>Próximos</p><strong>{details.upcoming.length}</strong><span>na agenda</span></article><article><p>Resultados</p><strong>{details.recent.length}</strong><span>recentes</span></article><article><p>Notícias</p><strong>{details.news.length}</strong><span>na central</span></article></div></div><HeroFocus details={details} featured={featured} /></section>;
}

function GuideSection({ details }: { details: SportHubDetails }) {
  return <section className={styles.guide}><div className={styles.guideIntro}><p>Como acompanhar</p><h2>O essencial de {details.sport.name}</h2><span>Formato, leitura rápida e atalhos para seguir a modalidade sem depender de dados incompletos.</span></div><GuideGrid items={details.config.guide} /><nav aria-label={`Atalhos de ${details.sport.name}`}><Link href={`/agenda?sport=${details.sport.id}`}>Agenda</Link><Link href="/ao-vivo">Ao vivo</Link><Link href="/favoritos">Favoritos</Link></nav></section>;
}

function TeamLayout({ details }: { details: SportHubDetails }) {
  return <><div className={styles.twoColumn}><EventsSection details={details} title={`Jogos de ${details.config.primaryCompetition}`} description="Ao vivo, próximos jogos e resultados recentes em uma única leitura." /><RankingSection details={details} /></div><EntitySection details={details} /><NewsSection details={details} /><GuideSection details={details} /></>;
}

function TourLayout({ details }: { details: SportHubDetails }) {
  return <><div className={styles.twoColumn}><CalendarSection details={details} title="Torneios e etapas" /><RankingSection details={details} /></div><EventsSection details={details} title="Eventos no radar" description="Torneios, etapas ou partidas que chegaram com horário e situação confirmados." /><EntitySection details={details} /><NewsSection details={details} /><GuideSection details={details} /></>;
}

function RaceLayout({ details }: { details: SportHubDetails }) {
  return <><CalendarSection details={details} title="Sessões e Grandes Prêmios" /><RankingSection details={details} /><div className={styles.twoColumn}><EventsSection details={details} title="Temporada no radar" description="Próximos GPs e resultados disponíveis para a temporada." /><EntitySection details={details} /></div><NewsSection details={details} /><GuideSection details={details} /></>;
}

function CombatLayout({ details }: { details: SportHubDetails }) {
  return <><EventsSection details={details} title="Cards e lutas" description="Próximos eventos e resultados publicados para o UFC." /><div className={styles.twoColumn}><EntitySection details={details} /><RankingSection details={details} /></div><NewsSection details={details} /><GuideSection details={details} /></>;
}

function EventLayout({ details }: { details: SportHubDetails }) {
  return <><EntitySection details={details} /><div className={styles.twoColumn}><CalendarSection details={details} title="Provas e competições" /><RankingSection details={details} /></div><NewsSection details={details} /><GuideSection details={details} /></>;
}

export function SportHubCenter({ details }: { details: SportHubDetails }) {
  return (
    <main>
      <LapHeader activeSport={details.sport.id} compact />
      <div className={`shell ${styles.page}`} data-sport={details.sport.id}>
        <nav className="article-breadcrumb" aria-label="Navegação estrutural"><Link href="/">Início</Link><span>›</span><span>{details.sport.name}</span></nav>
        <Hero details={details} />
        {details.config.layout === "team" && <TeamLayout details={details} />}
        {details.config.layout === "tour" && <TourLayout details={details} />}
        {details.config.layout === "race" && <RaceLayout details={details} />}
        {details.config.layout === "combat" && <CombatLayout details={details} />}
        {details.config.layout === "event" && <EventLayout details={details} />}
      </div>
    </main>
  );
}
