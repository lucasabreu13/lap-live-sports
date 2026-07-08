import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import type { SportUniverseDetails, SportHubItem } from "@/lib/sport-universe-data";
import styles from "./sport-universe-center.module.css";

function ItemCard({ item }: { item: SportHubItem }) {
  const content = (
    <>
      <span><p>{item.meta}</p><strong>{item.title}</strong><span>{item.value || "ver detalhes"}</span></span>
      {item.value && <em className={styles.value}>{item.value}</em>}
    </>
  );
  return item.href ? <Link href={item.href} className={styles.itemCard}>{content}</Link> : <article className={styles.itemCard}>{content}</article>;
}

export function SportUniverseCenter({ details }: { details: SportUniverseDetails }) {
  const featured = details.events[0] ?? null;
  return (
    <main>
      <LapHeader activeSport={details.sport.id} compact />
      <div className={`shell ${styles.page}`}>
        <nav className="article-breadcrumb" aria-label="Navegação estrutural">
          <Link href="/">Início</Link><span>›</span><span>{details.sport.name}</span>
        </nav>

        <section className={styles.hero}>
          <div className={styles.heroMain}>
            <p className={styles.kicker}>{details.sport.icon} Central da modalidade</p>
            <h1>{details.title.split(":")[0]} <span>{details.sport.name}</span></h1>
            <span>{details.subtitle}</span>
            <div className={styles.heroStats}>{details.metrics.map((metric) => <article key={metric.label}><p>{metric.label}</p><strong>{metric.value}</strong><span>{metric.hint}</span></article>)}</div>
          </div>
          <aside className={styles.panel}>
            <header className={styles.sectionHead}><div><p>Destaque</p><h2>Agora</h2><span>Evento, torneio ou radar principal da modalidade.</span></div></header>
            {featured ? <EventCard score={featured} /> : <div className={styles.empty}>Nenhum evento ao vivo no recorte atual. A central continua com calendário, ranking, entidades e notícias.</div>}
          </aside>
        </section>

        <section className={styles.gridTwo}>
          <article className={styles.panel}>
            <header className={styles.sectionHead}><div><p>Calendário</p><h2>Eventos e jogos</h2><span>Agenda, torneios ou próximos eventos disponíveis.</span></div><Link href="/agenda" className={styles.sectionLink}>Agenda</Link></header>
            {details.events.length ? <div className={styles.eventGrid}>{details.events.slice(0, 6).map((event) => <EventCard key={`${event.sportId}-${event.id}`} score={event} compact />)}</div> : details.calendar.length ? <div className={styles.itemGrid}>{details.calendar.slice(0, 8).map((item) => <ItemCard key={`${item.title}-${item.meta}`} item={item} />)}</div> : <div className={styles.empty}>Calendário em atualização.</div>}
          </article>
          <article className={styles.panel}>
            <header className={styles.sectionHead}><div><p>Ranking</p><h2>Destaques</h2><span>Leaderboard, ranking, times, atletas ou competições principais.</span></div></header>
            {details.ranking.length ? <div className={styles.itemGrid}>{details.ranking.slice(0, 8).map((item) => <ItemCard key={`${item.title}-${item.meta}`} item={item} />)}</div> : <div className={styles.empty}>Ranking será exibido quando a fonte publicar dados confiáveis.</div>}
          </article>
        </section>

        <section className={styles.panel} style={{ marginTop: 16 }}>
          <header className={styles.sectionHead}><div><p>Mapa da modalidade</p><h2>Competições, equipes e formatos</h2><span>Base visual para a página não ficar genérica fora de jogo ao vivo.</span></div></header>
          <div className={styles.itemGrid}>{details.entities.slice(0, 16).map((item) => <ItemCard key={`${item.title}-${item.meta}`} item={item} />)}</div>
        </section>

        <section className={styles.panel} style={{ marginTop: 16 }}>
          <header className={styles.sectionHead}><div><p>Como acompanhar</p><h2>Guia rápido</h2><span>O que importa nessa modalidade: formato, tabela, ranking e estatísticas.</span></div></header>
          <div className={styles.itemGrid}>{details.guide.map((item) => <ItemCard key={`${item.title}-${item.meta}`} item={item} />)}</div>
        </section>

        <section className={styles.panel} style={{ marginTop: 16 }}>
          <header className={styles.sectionHead}><div><p>Notícias</p><h2>Contexto editorial</h2><span>Últimas notícias e resumos para manter o usuário dentro da LAP.</span></div></header>
          {details.news.length ? <div className={styles.newsGrid}>{details.news.map((item) => <Link href={item.internalUrl} className={styles.newsCard} key={item.id}><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className={styles.empty}>Notícias aparecem aqui quando o feed editorial entregar novos conteúdos.</div>}
        </section>
      </div>
    </main>
  );
}
