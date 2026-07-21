import Link from "next/link";
import { LapHeader } from "@/components/lap-header";
import type { NewsItem } from "@/lib/live-data";
import type { ProTeamDetail } from "@/lib/rich-team-league-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./pro-team-page.module.css";

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

export function ProTeamPage({ detail, news }: { detail: ProTeamDetail; news: NewsItem[] }) {
  const sportId = detail.league === "nfl" ? "futebol-americano" : detail.league === "nba" ? "basquete" : "beisebol";
  const visual = sportCoverImage(sportId);
  const venueLine = [detail.venue.city, detail.venue.state].filter(Boolean).join(", ");
  const facts = [
    detail.standing ? { label: "Classificação", value: detail.standing } : null,
    detail.record ? { label: "Campanha", value: detail.record } : null,
    detail.venue.name ? { label: "Estádio / arena", value: detail.venue.name, hint: venueLine || null } : null,
    detail.venue.capacity ? { label: "Capacidade", value: detail.venue.capacity.toLocaleString("pt-BR") } : null,
    detail.roster.length ? { label: "Elenco", value: `${detail.roster.length} atletas` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string; hint?: string | null }>;

  return <main><LapHeader activeSport={sportId} /><div className={`shell ${styles.page}`}>
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><Link href={`/modalidades/${sportId}`}>{detail.league.toUpperCase()}</Link><span>›</span><span>{detail.team.name}</span></nav>
    <section className={styles.hero}>{detail.team.logo ? <img src={detail.team.logo} alt={`Escudo ${detail.team.name}`} /> : <span className={styles.logoFallback}>{detail.team.abbreviation || detail.team.shortName.slice(0, 2)}</span>}<div><p>{detail.league.toUpperCase()}</p><h1>{detail.team.name}</h1>{detail.team.location && detail.team.location !== detail.team.name ? <span>{detail.team.location}</span> : null}</div></section>

    {facts.length ? <section className={styles.facts}>{facts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong>{fact.hint ? <small>{fact.hint}</small> : null}</article>)}</section> : null}

    {detail.roster.length ? <section className={styles.section}><header><div><span>Elenco</span><h2>Jogadores</h2><p>Posição, idade e demais informações publicadas pela fonte.</p></div><strong>{detail.roster.length}</strong></header><div className={styles.roster}>{detail.roster.map((player) => {
      const main = [player.position, player.jersey ? `#${player.jersey}` : null].filter(Boolean).join(" · ");
      const extra = [player.age ? `${player.age} anos` : null, player.height, player.weight, player.experience, player.college, player.birthplace].filter(Boolean).join(" · ");
      return <article key={player.id} className={styles.player}>{player.headshot ? <img src={player.headshot} alt={player.name} /> : <span className={styles.avatar}>{player.jersey || player.name.slice(0, 1)}</span>}<div><strong>{player.name}</strong>{main ? <span>{main}</span> : null}{extra ? <small>{extra}</small> : null}</div></article>;
    })}</div></section> : null}

    {detail.schedule.length ? <section className={styles.section}><header><div><span>Temporada</span><h2>Jogos e resultados</h2></div></header><div className={styles.schedule}>{detail.schedule.map((game) => {
      const date = formatDate(game.date);
      const score = game.state === "post" && game.teamScore !== null && game.opponentScore !== null ? `${game.teamScore} × ${game.opponentScore}` : null;
      return <article key={game.id}><strong>{game.homeAway === "away" ? "@ " : game.homeAway === "home" ? "vs " : ""}{game.opponent}</strong>{score ? <span>{score}</span> : date ? <span>{date}</span> : null}{game.venue ? <small>{game.venue}</small> : game.status ? <small>{game.status}</small> : null}</article>;
    })}</div></section> : null}

    {news.length ? <section className={styles.section}><header><div><span>Notícias</span><h2>Últimas sobre {detail.team.shortName}</h2></div></header><div className={styles.news}>{news.map((item) => <Link key={item.id} href={item.internalUrl}><img src={item.imageUrl || visual.image} alt={item.imageAlt || item.title} /><span>{item.source}</span><strong>{item.title}</strong>{item.excerpt ? <small>{item.excerpt}</small> : null}</Link>)}</div></section> : null}
  </div></main>;
}
