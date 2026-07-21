import Link from "next/link";
import { LapHeader } from "@/components/lap-header";
import type { FootballTeamDetail } from "@/lib/football-team-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./pro-team-page.module.css";

export function FootballTeamPage({ detail }: { detail: FootballTeamDetail }) {
  const visual = sportCoverImage("futebol");
  const facts = [
    detail.standing ? { label: "Classificação", value: detail.standing } : null,
    detail.record ? { label: "Campanha", value: detail.record } : null,
    detail.venue ? { label: "Estádio", value: detail.venue } : null,
    detail.roster.length ? { label: "Elenco", value: `${detail.roster.length} atletas` } : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return <main><LapHeader activeSport="futebol" /><div className={`shell ${styles.page}`}>
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><Link href={`/campeonatos/${detail.competitionId}`}>{detail.competitionName}</Link><span>›</span><span>{detail.team.name}</span></nav>
    <section className={styles.hero}>{detail.team.logo ? <img src={detail.team.logo} alt={`Escudo ${detail.team.name}`} /> : <span className={styles.logoFallback}>{detail.team.abbreviation || detail.team.shortName.slice(0, 2)}</span>}<div><p>{detail.competitionName}</p><h1>{detail.team.name}</h1></div></section>
    {facts.length ? <section className={styles.facts}>{facts.map((fact) => <article key={fact.label}><span>{fact.label}</span><strong>{fact.value}</strong></article>)}</section> : null}
    {detail.roster.length ? <section className={styles.section}><header><div><span>Elenco</span><h2>Jogadores</h2><p>Posição, idade e demais informações publicadas pela fonte oficial do campeonato.</p></div><strong>{detail.roster.length}</strong></header><div className={styles.roster}>{detail.roster.map((player) => {
      const main = [player.position, player.jersey ? `#${player.jersey}` : null].filter(Boolean).join(" · ");
      const extra = [player.age ? `${player.age} anos` : null, player.height, player.weight, player.nationality].filter(Boolean).join(" · ");
      return <article key={player.id} className={styles.player}>{player.headshot ? <img src={player.headshot} alt={player.name} /> : <span className={styles.avatar}>{player.jersey || player.name.slice(0, 1)}</span>}<div><strong>{player.name}</strong>{main ? <span>{main}</span> : null}{extra ? <small>{extra}</small> : null}</div></article>;
    })}</div></section> : null}
    {detail.news.length ? <section className={styles.section}><header><div><span>Notícias</span><h2>Últimas sobre {detail.team.shortName}</h2></div></header><div className={styles.news}>{detail.news.map((item) => <Link key={item.id} href={item.internalUrl}><img src={item.imageUrl || visual.image} alt={item.imageAlt || item.title} />{item.source ? <span>{item.source}</span> : null}<strong>{item.title}</strong>{item.excerpt ? <small>{item.excerpt}</small> : null}</Link>)}</div></section> : null}
  </div></main>;
}
