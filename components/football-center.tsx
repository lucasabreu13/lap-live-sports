import Link from "next/link";
import { EventCard, eventHref } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import type { FootballHubDetails, FootballLeagueSummary } from "@/lib/football-hub-data";
import styles from "./football-center.module.css";

type FootballRegion = "Brasil" | "América do Sul" | "Europa" | "América do Norte" | "Outras regiões";

const REGION_ORDER: FootballRegion[] = ["Brasil", "América do Sul", "Europa", "América do Norte", "Outras regiões"];
const SOUTH_AMERICA = new Set(["América do Sul", "Argentina", "Uruguai", "Chile", "Colômbia", "Equador"]);
const NORTH_AMERICA = new Set(["Estados Unidos", "México", "Canadá"]);
const EUROPE = new Set(["Europa", "Inglaterra", "Espanha", "Itália", "Alemanha", "França", "Holanda", "Portugal", "Turquia", "Bélgica", "Escócia"]);

function regionFor(country: string): FootballRegion {
  if (country === "Brasil") return "Brasil";
  if (SOUTH_AMERICA.has(country)) return "América do Sul";
  if (EUROPE.has(country)) return "Europa";
  if (NORTH_AMERICA.has(country)) return "América do Norte";
  return "Outras regiões";
}

function leagueStatus(league: FootballLeagueSummary) {
  if (league.live) return { label: "Ao vivo", tone: "live" };
  if (league.upcoming) return { label: "Com jogos marcados", tone: "scheduled" };
  if (league.recent) return { label: "Com resultados", tone: "results" };
  return { label: "Agenda em atualização", tone: "quiet" };
}

function localDay(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(date);
}

function LeagueCard({ league }: { league: FootballLeagueSummary }) {
  const status = leagueStatus(league);
  return (
    <article className={styles.leagueCard}>
      <div className={styles.leagueTop}>
        <span><p>{league.country}</p><strong>{league.name}</strong></span>
        <em data-tone={status.tone}>{status.label}</em>
      </div>
      <div className={styles.leagueStats}>
        <span><strong>{league.live}</strong> ao vivo</span>
        <span><strong>{league.upcoming}</strong> próximos</span>
        <span><strong>{league.recent}</strong> resultados</span>
      </div>
      <Link href={`/campeonatos/${league.id}`} className={styles.leagueOpen}>Abrir competição</Link>
    </article>
  );
}

export function FootballCenter({ details }: { details: FootballHubDetails }) {
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;
  const activeLeagues = details.leagues.filter((league) => league.total > 0);
  const today = localDay(new Date().toISOString());
  const todayEvents = [...details.live, ...details.upcoming].filter((event) => localDay(event.startTime) === today);
  const nextEvents = (todayEvents.length ? todayEvents : [...details.live, ...details.upcoming]).slice(0, 8);
  const groups = REGION_ORDER.map((region) => ({
    region,
    leagues: details.leagues.filter((league) => regionFor(league.country) === region),
  })).filter((group) => group.leagues.length);

  return (
    <main>
      <LapHeader activeSport="futebol" compact />
      <div className={`shell ${styles.page}`}>
        <nav className="article-breadcrumb" aria-label="Navegação estrutural">
          <Link href="/">Início</Link><span>›</span><span>Futebol</span>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.kicker}>Central da modalidade</p>
            <h1>Futebol na LAP</h1>
            <span>Do Brasil ao futebol mundial: ligas, partidas, classificação, resultados e notícias organizados para leitura rápida.</span>
            <div className={styles.heroStats}>
              <article><p>Ao vivo</p><strong>{details.live.length}</strong><span>agora</span></article>
              <article><p>Próximos</p><strong>{details.upcoming.length}</strong><span>na agenda</span></article>
              <article><p>Resultados</p><strong>{details.recent.length}</strong><span>recentes</span></article>
              <article><p>Ligas</p><strong>{details.leagues.length}</strong><span>{activeLeagues.length} com jogos</span></article>
            </div>
          </div>
          <aside className={styles.panel}>
            <header className={styles.sectionHead}><div><p>Destaque</p><h2>Agora</h2><span>O jogo mais relevante disponível neste momento.</span></div></header>
            {featured ? <><EventCard score={featured} /><Link href={eventHref(featured)} className={styles.sectionLink}>Acompanhar evento</Link></> : <div className={styles.empty}>Nenhum jogo em andamento. Os próximos confrontos continuam logo abaixo.</div>}
          </aside>
        </section>

        <section className={styles.panelSection}>
          <header className={styles.sectionHead}>
            <div><p>Competições</p><h2>Todas as ligas mapeadas</h2><span>Navegue por país e região. Cada competição abre agenda, resultados, clubes, classificação e notícias próprias.</span></div>
            <Link className={styles.sectionLink} href="/agenda">Agenda completa</Link>
          </header>
          <div className={styles.regionStack}>
            {groups.map((group) => <section className={styles.region} key={group.region}><header><h3>{group.region}</h3><span>{group.leagues.length} competições</span></header><div className={styles.leagueGrid}>{group.leagues.map((league) => <LeagueCard league={league} key={league.id} />)}</div></section>)}
          </div>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.panelSection}>
            <header className={styles.sectionHead}><div><p>{todayEvents.length ? "Hoje" : "Próximos jogos"}</p><h2>Agenda de partidas</h2><span>{todayEvents.length ? "Partidas do dia no horário de Brasília." : "Próximos confrontos confirmados."}</span></div><Link className={styles.sectionLink} href="/agenda?sport=futebol">Ver agenda</Link></header>
            {nextEvents.length ? <div className={styles.eventGrid}>{nextEvents.map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact />)}</div> : <div className={styles.empty}>A agenda será preenchida assim que novas partidas forem publicadas.</div>}
          </section>

          <section className={styles.panelSection}>
            <header className={styles.sectionHead}><div><p>Resultados recentes</p><h2>Últimos placares</h2><span>Partidas encerradas, sem misturar placares ainda não confirmados.</span></div></header>
            {details.recent.length ? <div className={styles.eventGrid}>{details.recent.slice(0, 8).map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact />)}</div> : <div className={styles.empty}>Os resultados aparecem aqui após o encerramento das partidas.</div>}
          </section>
        </div>

        <section className={styles.panelSection}>
          <header className={styles.sectionHead}><div><p>Notícias de futebol</p><h2>Últimas histórias</h2><span>Resumos e matérias organizados dentro da LAP.</span></div></header>
          {details.news.length ? <div className={styles.newsGrid}>{details.news.slice(0, 8).map((item) => <Link href={item.internalUrl} className={styles.newsCard} key={item.id}><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className={styles.empty}>As próximas notícias de futebol entram aqui assim que forem publicadas.</div>}
        </section>

        <section className={styles.guide}>
          <div><p>Como acompanhar</p><h2>Sua rota pelo futebol</h2><span>Abra a Central Ao Vivo durante os jogos, use a agenda para planejar o dia e salve ligas ou partidas na Minha LAP.</span></div>
          <nav aria-label="Atalhos do futebol"><Link href="/ao-vivo">Central Ao Vivo</Link><Link href="/agenda?sport=futebol">Agenda</Link><Link href="/favoritos">Favoritos</Link></nav>
        </section>
      </div>
    </main>
  );
}
