"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { StandingGroups } from "@/components/sport-hubs/standing-groups";
import type { ProLeagueHub, ProTeam, ProTeamDetail } from "@/lib/rich-team-league-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./rich-team-league-center.module.css";

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "Data a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function TeamLogo({ team, size = 48 }: { team: ProTeam; size?: number }) {
  if (team.logo) return <img className={styles.logo} src={team.logo} alt={`Logo ${team.name}`} width={size} height={size} />;
  return <span className={styles.logoFallback} style={{ width: size, height: size }}>{team.abbreviation || team.shortName.slice(0, 2)}</span>;
}

function TeamDrawer({ detail, loading, error, onClose }: { detail: ProTeamDetail | null; loading: boolean; error: string | null; onClose: () => void }) {
  if (!detail && !loading && !error) return null;
  return <div className={styles.backdrop} onMouseDown={onClose}><aside className={styles.drawer} onMouseDown={(event) => event.stopPropagation()}>
    <button className={styles.close} onClick={onClose} aria-label="Fechar">×</button>
    {loading && <div className={styles.loading}>Buscando dados reais do time, elenco, estádio e calendário…</div>}
    {error && <div className={styles.error}>{error}</div>}
    {detail && !loading && <>
      <header className={styles.drawerHero}><TeamLogo team={detail.team} size={78} /><div><span>{detail.league.toUpperCase()}</span><h2>{detail.team.name}</h2><p>{detail.standing || detail.record || "Temporada em atualização"}</p></div></header>
      <section className={styles.factGrid}>
        <article><span>Estádio / arena</span><strong>{detail.venue.name || "Não publicado"}</strong><small>{[detail.venue.city, detail.venue.state].filter(Boolean).join(", ") || "Localização não publicada"}</small></article>
        <article><span>Capacidade</span><strong>{detail.venue.capacity ? detail.venue.capacity.toLocaleString("pt-BR") : "—"}</strong><small>{detail.venue.indoor === null ? "Tipo não informado" : detail.venue.indoor ? "Coberto" : "Aberto"}</small></article>
        <article><span>Elenco carregado</span><strong>{detail.roster.length}</strong><small>Atletas retornados pela fonte</small></article>
        <article><span>Folha conhecida</span><strong>{detail.knownPayroll ? money(detail.knownPayroll) : "—"}</strong><small>{detail.salaryCoverage} salários associados ao roster</small></article>
      </section>

      <section className={styles.drawerSection}><header><div><span>Roster</span><h3>Jogadores</h3></div><small>{detail.roster.length} atletas</small></header>
        {detail.roster.length ? <div className={styles.roster}>{detail.roster.map((player) => <article key={player.id}>
          {player.headshot ? <img src={player.headshot} alt={player.name} width={52} height={52} /> : <span className={styles.avatar}>{player.jersey || "#"}</span>}
          <div><strong>{player.name}</strong><span>{[player.position, player.jersey ? `#${player.jersey}` : null, player.experience].filter(Boolean).join(" · ") || "Posição não publicada"}</span><small>{[player.age ? `${player.age} anos` : null, player.height, player.weight, player.college, player.birthplace].filter(Boolean).join(" · ")}</small></div>
          <em>{player.salary || "Salário não publicado"}</em>
        </article>)}</div> : <p className={styles.empty}>O roster não foi publicado pela fonte neste momento.</p>}
      </section>

      <section className={styles.drawerSection}><header><div><span>Temporada</span><h3>Calendário</h3></div><small>{detail.schedule.length} jogos</small></header>
        {detail.schedule.length ? <div className={styles.schedule}>{detail.schedule.map((game) => <article key={game.id}>
          <div>{game.opponentLogo ? <img src={game.opponentLogo} alt="" width={30} height={30} /> : null}<strong>{game.homeAway === "away" ? "@ " : "vs "}{game.opponent}</strong></div>
          <span>{game.state === "post" ? `${game.teamScore ?? "-"} × ${game.opponentScore ?? "-"}` : formatDate(game.date)}</span>
          <small>{game.venue || game.status}</small>
        </article>)}</div> : <p className={styles.empty}>O calendário da temporada ainda não foi retornado para esta franquia.</p>}
      </section>
      <p className={styles.note}>Salários só aparecem quando uma fonte pública consegue associar o nome do atleta ao roster atual. A LAP não estima contratos nem inventa valores ausentes.</p>
    </>}
  </aside></div>;
}

export function RichTeamLeagueCenter({ hub }: { hub: ProLeagueHub }) {
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<ProTeamDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visual = sportCoverImage(hub.config.sportId);
  const filtered = useMemo(() => {
    const needle = query.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    if (!needle) return hub.teams;
    return hub.teams.filter((team) => `${team.name} ${team.shortName} ${team.location} ${team.abbreviation}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(needle));
  }, [hub.teams, query]);
  const events = [...hub.live, ...hub.upcoming, ...hub.recent].slice(0, 12);

  async function openTeam(team: ProTeam) {
    setLoading(true); setDetail(null); setError(null);
    try {
      const response = await fetch(`/api/pro-league/team/${hub.config.id}/${encodeURIComponent(team.id)}`, { cache: "no-store" });
      const payload = await response.json() as ProTeamDetail | { error?: string };
      if (!response.ok || !("team" in payload)) throw new Error("error" in payload && payload.error ? payload.error : "Falha ao carregar o time.");
      setDetail(payload);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Falha ao carregar o time."); }
    finally { setLoading(false); }
  }

  return <main><LapHeader activeSport={hub.config.sportId} compact /><div className={`shell ${styles.page}`}>
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><span>{hub.config.label}</span></nav>
    <section className={styles.hero}><img src={visual.image} alt={visual.alt} /><div className={styles.heroOverlay}><span>Central completa</span><h1>{hub.config.title}</h1><p>{hub.config.subtitle}</p><div className={styles.metrics}><article><strong>{hub.teams.length}</strong><span>franquias</span></article><article><strong>{hub.live.length}</strong><span>ao vivo</span></article><article><strong>{hub.upcoming.length}</strong><span>próximos</span></article><article><strong>{hub.news.length}</strong><span>notícias</span></article></div></div></section>

    <section className={styles.section}><header className={styles.sectionHead}><div><span>Franquias</span><h2>Explore todos os times</h2><p>Clique em uma franquia para abrir roster, posições, estádio ou arena, capacidade, salários disponíveis e calendário.</p></div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar time" /></header>
      <div className={styles.teamGrid}>{filtered.map((team) => <button key={team.id} onClick={() => void openTeam(team)}><TeamLogo team={team} /><span><strong>{team.shortName}</strong><small>{team.location} · {team.abbreviation}</small></span><b>→</b></button>)}</div>
    </section>

    <section className={styles.section}><header className={styles.sectionHead}><div><span>Temporada</span><h2>Jogos e resultados</h2><p>Ao vivo, próximos compromissos e resultados recentes.</p></div><Link href={`/agenda?sport=${hub.config.sportId}`}>Agenda completa</Link></header>
      {events.length ? <div className={styles.eventGrid}>{events.map((event) => <EventCard key={event.id} score={event} compact />)}</div> : <div className={styles.empty}>A liga está fora de temporada ou o calendário ainda não foi publicado.</div>}
    </section>

    <section className={styles.section}><header className={styles.sectionHead}><div><span>Classificação</span><h2>Standings</h2><p>Campanha e posição conforme os dados publicados para a temporada.</p></div></header>
      {hub.standings.length ? <StandingGroups groups={hub.standings.slice(0, 10)} limit={32} /> : <div className={styles.empty}>Classificação em atualização.</div>}
    </section>

    <section className={styles.section}><header className={styles.sectionHead}><div><span>Notícias {hub.config.label}</span><h2>Últimas histórias</h2><p>Notícias e contexto para acompanhar a liga mesmo entre jogos.</p></div></header>
      {hub.news.length ? <div className={styles.newsGrid}>{hub.news.map((item) => <Link key={item.id} href={item.internalUrl}><img src={item.imageUrl || visual.image} alt={item.imageAlt || visual.alt} loading="lazy" /><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className={styles.empty}>As próximas notícias entram aqui assim que forem publicadas.</div>}
    </section>
  </div><TeamDrawer detail={detail} loading={loading} error={error} onClose={() => { setDetail(null); setError(null); }} /></main>;
}
