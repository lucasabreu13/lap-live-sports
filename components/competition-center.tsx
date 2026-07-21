import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { eventDisplayTitle } from "@/lib/event-presentation";
import { footballTeamSlug } from "@/lib/football-team-data";
import type { CompetitionDetails } from "@/lib/live-data";

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}
function scoreCount(details: CompetitionDetails) { return details.live.length + details.upcoming.length + details.recent.length; }
function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LAP"; }
function TeamMark({ name, logo, size = 28 }: { name: string; logo: string | null; size?: number }) { return <span className="competition-team-mark" style={{ width: size, height: size }}>{logo ? <img src={logo} alt="" width={size} height={size} loading="lazy" /> : <span>{initials(name)}</span>}</span>; }

export function CompetitionCenter({ details }: { details: CompetitionDetails }) {
  const { competition } = details;
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;
  const tableRows = details.table.filter((row) => row.played > 0 || row.position !== null);
  const hasTable = details.tableSource !== "unavailable" && tableRows.length >= 2;
  const hasLeaders = details.leaders.length > 0;
  return <main><LapHeader activeSport="futebol" compact /><div className="shell competition-page">
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><Link href="/modalidades/futebol">Futebol</Link><span>›</span><span>{competition.name}</span></nav>
    <section className="competition-hero"><div><p>{competition.country}</p><h1>{competition.name}</h1><span>Jogos, resultados, clubes e notícias em uma central dedicada da LAP.</span></div>{scoreCount(details) ? <aside><strong>{scoreCount(details)}</strong><span>jogos no radar</span>{details.live.length ? <small>{details.live.length} ao vivo</small> : null}</aside> : null}</section>

    {featured ? <section className="competition-feature"><div><p>Destaque</p><h2>{eventDisplayTitle(featured)}</h2>{(featured.state === "post" ? featured.status : formatDateTime(featured.startTime)) ? <span>{featured.state === "post" ? featured.status : formatDateTime(featured.startTime)}</span> : null}<Link className="competition-feature__button" href={`/jogos/${featured.sportId}/${featured.id}`}>Acompanhar evento</Link></div><EventCard score={featured} /></section> : null}

    {(hasTable || hasLeaders) ? <section className="competition-grid">
      {hasTable ? <article className="competition-panel competition-panel--wide"><header><p>Classificação</p><h2>{details.tableSource === "official" ? "Tabela atual" : "Resumo dos resultados"}</h2></header><div className="competition-table-wrap"><table className="competition-table"><thead><tr><th>Pos.</th><th>Time</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th><th>Forma</th></tr></thead><tbody>{tableRows.map((row) => <tr key={`${row.group || "geral"}-${row.team}`}><td>{row.position ?? ""}</td><td><Link href={`/times/futebol/${competition.id}/${footballTeamSlug(row.team)}`}><TeamMark name={row.team} logo={row.logo} size={24} /><span>{row.team}{row.group ? <small>{row.group}</small> : null}</span></Link></td><td>{row.played ? row.points : ""}</td><td>{row.played || ""}</td><td>{row.played ? row.wins : ""}</td><td>{row.played ? row.draws : ""}</td><td>{row.played ? row.losses : ""}</td><td>{row.played ? row.goalsFor - row.goalsAgainst : ""}</td><td>{row.form.length ? row.form.join(" ") : ""}</td></tr>)}</tbody></table></div></article> : null}
      {hasLeaders ? <article className="competition-panel"><header><p>Raio-X</p><h2>Destaques</h2></header><div className="competition-leaders">{details.leaders.map((leader) => <div key={leader.label}><span>{leader.label}</span><strong>{leader.team}</strong><small>{leader.value}</small></div>)}</div></article> : null}
    </section> : null}

    {details.teams.length ? <section className="hub-section competition-teams"><header className="hub-section__heading"><div><p>Clubes</p><h2>Todos os times</h2></div></header><div className="competition-team-grid">{details.teams.map((team) => <Link key={team.name} href={`/times/futebol/${competition.id}/${footballTeamSlug(team.name)}`}><TeamMark name={team.name} logo={team.logo} size={42} /><strong>{team.name}</strong></Link>)}</div></section> : null}

    {details.playerLeaders.length ? <section className="competition-individual-leaders"><div><p>Desempenho individual</p><h2>Artilharia e líderes</h2></div><div>{details.playerLeaders.map((leader) => <article key={`${leader.category}-${leader.name}`}><span>{leader.category}</span><strong>{leader.name}</strong>{[leader.team, leader.value].filter(Boolean).length ? <small>{[leader.team, leader.value].filter(Boolean).join(" · ")}</small> : null}</article>)}</div></section> : null}

    {details.upcoming.length ? <section className="hub-section"><header className="hub-section__heading"><div><p>Próximos jogos</p><h2>Agenda</h2></div></header><div className="full-schedule__grid">{details.upcoming.slice(0, 12).map((event) => <EventCard key={event.id} score={event} />)}</div></section> : null}
    {details.recent.length ? <section className="hub-section"><header className="hub-section__heading"><div><p>Resultados recentes</p><h2>Últimos placares</h2></div></header><div className="full-schedule__grid">{details.recent.slice(0, 12).map((event) => <EventCard key={event.id} score={event} />)}</div></section> : null}
    {details.news.length ? <section className="hub-section"><header className="hub-section__heading"><div><p>Notícias relacionadas</p><h2>Contexto editorial</h2></div></header><div className="competition-news">{details.news.map((item) => <Link key={item.id} href={item.internalUrl}>{item.source ? <span>{item.source}</span> : null}<strong>{item.title}</strong>{item.excerpt ? <small>{item.excerpt}</small> : null}</Link>)}</div></section> : null}
    <section className="competition-guide"><div><p>Como acompanhar</p><h2>Continue na competição</h2></div><nav><Link href="/ao-vivo">Central Ao Vivo</Link><Link href={`/agenda?liga=${competition.id}`}>Agenda da liga</Link><Link href="/favoritos">Meus favoritos</Link></nav></section>
  </div></main>;
}
