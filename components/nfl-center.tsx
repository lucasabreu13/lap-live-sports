import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { StandingGroups } from "@/components/sport-hubs/standing-groups";
import { eventDisplayTitle, eventHref } from "@/lib/event-presentation";
import type { NflCenterDetails, NflDivision } from "@/lib/nfl-data";
import type { ScoreItem } from "@/lib/live-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./nfl-center.module.css";

function eventTitle(event: ScoreItem) {
  return eventDisplayTitle(event);
}

function featuredLabel(event: ScoreItem | null) {
  if (!event) return "Temporada NFL";
  if (event.state === "in") return "Ao vivo agora";
  if (event.state === "post") return "Último resultado";
  return "Próximo jogo";
}

function DivisionCard({ division }: { division: NflDivision }) {
  return (
    <article className={styles.divisionCard}>
      <p>{division.conference}</p>
      <h3>{division.division}</h3>
      <ul className={styles.teamList}>
        {division.teams.map((team) => (
          <li key={`${division.conference}-${division.division}-${team.abbr}`}>
            <span className={styles.badge} aria-hidden="true">
              <img src={team.logo} alt="" width="30" height="30" loading="lazy" />
            </span>
            <span><strong>{team.city}</strong><span>{team.name}</span></span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function NflCenter({ details }: { details: NflCenterDetails }) {
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;
  const schedulePreview = [...details.live, ...details.upcoming, ...details.recent].slice(0, 8);
  const afc = details.divisions.filter((division) => division.conference === "AFC");
  const nfc = details.divisions.filter((division) => division.conference === "NFC");

  return (
    <main>
      <LapHeader activeSport="futebol-americano" compact />
      <div className={`shell ${styles.page}`}>
        <nav className="article-breadcrumb" aria-label="Navegação estrutural">
          <Link href="/">Início</Link>
          <span>›</span>
          <span>NFL</span>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <img className={styles.heroImage} src={sportCoverImage("futebol-americano").image} alt={sportCoverImage("futebol-americano").alt} />
            <p className={styles.kicker}>Central da liga</p>
            <h1>NFL na LAP</h1>
            <span>Calendário, resultados, conferências, divisões, 32 franquias e notícias da temporada em um só lugar.</span>
            <div className={styles.heroStats}>
              <article><p>Ao vivo</p><strong>{details.live.length}</strong></article>
              <article><p>Próximos</p><strong>{details.upcoming.length}</strong></article>
              <article><p>Times</p><strong>32</strong></article>
            </div>
          </div>

          <aside className={styles.feature}>
            <div className={styles.featureHead}>
              <div><p>{featuredLabel(featured)}</p><h2>Destaque</h2></div>
              <Link href="/agenda" className={styles.featureLink}>Agenda</Link>
            </div>
            {featured ? <EventCard score={featured} /> : <div className={styles.empty}>A NFL está entre rodadas ou fora de temporada. Divisões, franquias e notícias continuam disponíveis.</div>}
            {featured && <Link href={eventHref(featured)} className={styles.sectionLink}>Abrir {eventTitle(featured)} →</Link>}
          </aside>
        </section>

        <section className={styles.gridTwo}>
          <article className={styles.panel}>
            <header className={styles.sectionHead}>
              <div><p>Calendário</p><h2>Jogos da NFL</h2><span>Ao vivo, próximos jogos e resultados recentes em leitura rápida.</span></div>
              <Link href="/agenda" className={styles.sectionLink}>Ver agenda</Link>
            </header>
            {schedulePreview.length ? <div className={styles.eventGrid}>{schedulePreview.map((event) => <EventCard key={event.id} score={event} compact />)}</div> : <div className={styles.empty}>Quando o calendário da liga estiver disponível no feed, os jogos aparecem aqui automaticamente.</div>}
          </article>

          <article className={styles.panel}>
            <header className={styles.sectionHead}>
              <div><p>Guia rápido</p><h2>Como acompanhar</h2><span>A NFL precisa de contexto diferente de futebol: semana, conferência, divisão, campanha e playoffs.</span></div>
            </header>
            <div className={styles.eventGrid}>
              <div className={styles.empty}>Use a aba Agenda para ver jogos por data, e favorite times ou a modalidade para priorizar alertas.</div>
              <div className={styles.empty}>A classificação organiza divisões e conferências; o wild card completa o caminho para os playoffs.</div>
            </div>
          </article>
        </section>

        <section className={`${styles.panel} ${styles.spacedPanel}`}>
          <header className={styles.sectionHead}>
            <div><p>Classificação</p><h2>AFC e NFC</h2><span>Campanhas por conferência e divisão, exibidas quando a temporada publica os números.</span></div>
          </header>
          {details.standings.length ? <StandingGroups groups={details.standings.slice(0, 8)} limit={16} /> : <div className={styles.empty}><strong>Dados oficiais em atualização.</strong> A estrutura permanece pronta sem preencher posições manualmente.</div>}
        </section>

        <section className={`${styles.panel} ${styles.spacedPanel}`}>
          <header className={styles.sectionHead}>
            <div><p>Conferências</p><h2>AFC</h2><span>Leste, Norte, Sul e Oeste da Conferência Americana.</span></div>
          </header>
          <div className={styles.divisionGrid}>{afc.map((division) => <DivisionCard key={`${division.conference}-${division.division}`} division={division} />)}</div>
        </section>

        <section className={`${styles.panel} ${styles.spacedPanel}`}>
          <header className={styles.sectionHead}>
            <div><p>Conferências</p><h2>NFC</h2><span>Leste, Norte, Sul e Oeste da Conferência Nacional.</span></div>
          </header>
          <div className={styles.divisionGrid}>{nfc.map((division) => <DivisionCard key={`${division.conference}-${division.division}`} division={division} />)}</div>
        </section>

        <section className={`${styles.panel} ${styles.spacedPanel}`}>
          <header className={styles.sectionHead}>
            <div><p>Notícias NFL</p><h2>Contexto da liga</h2><span>Principais atualizações de futebol americano para manter retenção mesmo sem jogo ao vivo.</span></div>
          </header>
          {details.news.length ? <div className={styles.newsGrid}>{details.news.map((item) => <Link key={item.id} href={item.internalUrl} className={styles.newsCard}><img src={item.imageUrl || sportCoverImage("futebol-americano").image} alt={item.imageAlt || sportCoverImage("futebol-americano").alt} loading="lazy" /><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className={styles.empty}>Notícias da NFL aparecem aqui assim que novos conteúdos forem publicados.</div>}
        </section>
      </div>
    </main>
  );
}
