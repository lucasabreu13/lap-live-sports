import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import type { FootballHubDetails } from "@/lib/football-hub-data";
import styles from "./football-center.module.css";

export function FootballCenter({ details }: { details: FootballHubDetails }) {
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;
  const activeLeagues = details.leagues.filter((league) => league.total > 0);
  const primaryLeagues = [...details.leagues].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return (
    <main>
      <LapHeader activeSport="futebol" compact />
      <div className={`shell ${styles.page}`}>
        <nav className="article-breadcrumb" aria-label="Navegação estrutural">
          <Link href="/">Início</Link><span>›</span><span>Futebol</span>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.kicker}>Central de futebol</p>
            <h1>Futebol completo: ligas, jogos e <span>cobertura</span>.</h1>
            <span>Agora a modalidade abre com todas as competições mapeadas da LAP, atalhos por liga, agenda, resultados e notícias.</span>
            <div className={styles.heroStats}>
              <article><p>Ligas</p><strong>{details.leagues.length}</strong></article>
              <article><p>Ativas</p><strong>{activeLeagues.length}</strong></article>
              <article><p>Ao vivo</p><strong>{details.live.length}</strong></article>
            </div>
          </div>
          <aside className={styles.panel}>
            <header className={styles.sectionHead}><div><p>Destaque</p><h2>Agora</h2><span>Jogo ou resultado mais relevante no radar.</span></div></header>
            {featured ? <EventCard score={featured} /> : <div className={styles.empty}>Nenhum jogo de futebol em destaque no recorte atual.</div>}
          </aside>
        </section>

        <section className={styles.panel} style={{ marginTop: 16 }}>
          <header className={styles.sectionHead}>
            <div><p>Ligas mapeadas</p><h2>Competições</h2><span>Cada liga abre uma página própria com agenda, resultados, tabela/resumo e notícias.</span></div>
            <Link className={styles.sectionLink} href="/agenda">Ver agenda</Link>
          </header>
          <div className={styles.leagueGrid}>
            {primaryLeagues.map((league) => (
              <Link href={`/campeonatos/${league.id}`} className={styles.leagueCard} key={league.id}>
                <span><p>{league.country}</p><strong>{league.name}</strong><span>{league.tier === "global" ? "Liga prioritária" : league.tier === "major" ? "Liga importante" : "Liga regional"}</span></span>
                <span className={styles.leagueStats}>
                  <em>{league.live} ao vivo</em><em>{league.upcoming} próx.</em><em>{league.recent} res.</em>
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.panel} style={{ marginTop: 16 }}>
          <header className={styles.sectionHead}><div><p>Jogos</p><h2>Próximos e resultados</h2><span>Lista curta para leitura rápida; a agenda completa continua em /agenda.</span></div></header>
          {[...details.live, ...details.upcoming, ...details.recent].length ? <div className={styles.eventGrid}>{[...details.live, ...details.upcoming, ...details.recent].slice(0, 8).map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact />)}</div> : <div className={styles.empty}>Os jogos aparecem aqui assim que as fontes publicarem novos eventos.</div>}
        </section>

        <section className={styles.panel} style={{ marginTop: 16 }}>
          <header className={styles.sectionHead}><div><p>Notícias</p><h2>Contexto do futebol</h2><span>Últimas matérias e resumos para aumentar retenção.</span></div></header>
          {details.news.length ? <div className={styles.newsGrid}>{details.news.slice(0, 8).map((item) => <Link href={item.internalUrl} className={styles.newsCard} key={item.id}><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className={styles.empty}>Notícias aparecem quando o feed editorial estiver disponível.</div>}
        </section>
      </div>
    </main>
  );
}
