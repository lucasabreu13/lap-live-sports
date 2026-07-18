import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
import { eventDisplayTitle } from "@/lib/event-presentation";
import type { CompetitionDetails } from "@/lib/live-data";

function formatDateTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function eventTitle(event: CompetitionDetails["upcoming"][number]) {
  return eventDisplayTitle(event);
}

function scoreCount(details: CompetitionDetails) {
  return details.live.length + details.upcoming.length + details.recent.length;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LAP";
}

function TeamMark({ name, logo, size = 28 }: { name: string; logo: string | null; size?: number }) {
  return <span className="competition-team-mark" style={{ width: size, height: size }}>{logo ? <img src={logo} alt="" width={size} height={size} loading="lazy" /> : <span>{initials(name)}</span>}</span>;
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <article><p>{label}</p><strong>{value}</strong><span>{hint}</span></article>;
}

export function CompetitionCenter({ details }: { details: CompetitionDetails }) {
  const { competition } = details;
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;
  const hasUsefulTable = details.tableSource !== "unavailable" && details.table.filter((row) => row.played > 0).length >= 2;
  const tableTitle = details.tableSource === "official" ? "Classificação atual" : details.tableSource === "recent-results" ? "Resumo dos resultados" : "Times da competição";

  return (
    <main>
      <LapHeader activeSport="futebol" compact />
      <div className="shell competition-page">
        <nav className="article-breadcrumb" aria-label="Navegação estrutural">
          <Link href="/">Início</Link>
          <span>›</span>
          <Link href="/modalidades/futebol">Futebol</Link>
          <span>›</span>
          <span>{competition.name}</span>
        </nav>

        <section className="competition-hero">
          <div>
            <p>{competition.country}</p>
            <h1>{competition.name}</h1>
            <span>Jogos, resultados, agenda e notícias em uma central dedicada da LAP.</span>
          </div>
          <aside>
            <strong>{scoreCount(details)}</strong>
            <span>jogos no radar</span>
            <small>{details.live.length} ao vivo</small>
          </aside>
        </section>

        {details.sourceNote && scoreCount(details) === 0 && <p className="status-note">Não encontramos jogos desta competição agora. Tente novamente em instantes ou abra a agenda geral.</p>}

        <section className="competition-feature">
          <div>
            <p>Destaque</p>
            {featured ? (
              <>
                <h2>{eventTitle(featured)}</h2>
                {(featured.state === "post" ? featured.status : formatDateTime(featured.startTime)) && <span>{featured.state === "post" ? featured.status : formatDateTime(featured.startTime)}</span>}
                <Link className="competition-feature__button" href={`/jogos/${featured.sportId}/${featured.id}`}>Acompanhar evento</Link>
              </>
            ) : (
              <>
                <h2>Agenda em atualização</h2>
                <span>Quando houver jogos publicados, eles entram aqui automaticamente.</span>
                <Link className="competition-feature__button" href="/agenda">Ver agenda geral</Link>
              </>
            )}
          </div>
          {featured ? <EventCard score={featured} /> : <div className="empty-card">Sem partida ativa neste recorte.</div>}
        </section>

        <section className="competition-grid">
          <article className="competition-panel competition-panel--wide">
            <header>
              <p>Resumo</p>
              <h2>{tableTitle}</h2>
            </header>
            {details.table.length ? (
              <div className="competition-table-wrap">
                <table className="competition-table">
                  <thead>
                    <tr>
                      <th>Pos.</th>
                      <th>Time</th>
                      <th>Pts</th>
                      <th>J</th>
                      <th>V</th>
                      <th>E</th>
                      <th>D</th>
                      <th>SG</th>
                      <th>Forma</th>
                    </tr>
                  </thead>
                  <tbody>
                    {details.table.map((row) => (
                      <tr key={`${row.group || "geral"}-${row.team}`}>
                        <td>{row.position ?? "—"}</td>
                        <td><TeamMark name={row.team} logo={row.logo} size={24} /><span>{row.team}{row.group && <small>{row.group}</small>}</span></td>
                        <td>{row.played ? row.points : "—"}</td>
                        <td>{row.played || "—"}</td>
                        <td>{row.played ? row.wins : "—"}</td>
                        <td>{row.played ? row.draws : "—"}</td>
                        <td>{row.played ? row.losses : "—"}</td>
                        <td>{row.played ? row.goalsFor - row.goalsAgainst : "—"}</td>
                        <td>{row.form.length ? row.form.join(" ") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="competition-panel__empty">A tabela aparece quando houver jogos encontrados para esta competição.</p>}
            <small>{details.tableSource === "official" ? "Classificação disponível para a temporada atual." : hasUsefulTable ? "Resumo calculado somente com os resultados encontrados neste período." : "Sem resultados suficientes para montar uma classificação confiável agora."}</small>
          </article>

          <article className="competition-panel">
            <header>
              <p>Raio-X</p>
              <h2>Competição</h2>
            </header>
            <div className="competition-leaders">
              <StatCard label="Ao vivo" value={details.live.length} hint="jogos em andamento" />
              <StatCard label="Próximos" value={details.upcoming.length} hint="na agenda" />
              <StatCard label="Resultados" value={details.recent.length} hint="encerrados recentemente" />
              {details.leaders.map((leader) => <div key={leader.label}><span>{leader.label}</span><strong>{leader.team}</strong><small>{leader.value}</small></div>)}
            </div>
          </article>
        </section>

        <section className="hub-section competition-teams">
          <header className="hub-section__heading"><div><p>Clubes</p><h2>Times detectados</h2></div></header>
          {details.teams.length ? <div className="competition-team-grid">{details.teams.map((team) => <article key={team.name}><TeamMark name={team.name} logo={team.logo} size={42} /><strong>{team.name}</strong></article>)}</div> : <div className="empty-card">Os times aparecem aqui quando a competição publicar sua lista ou seus primeiros jogos.</div>}
        </section>

        <section className="competition-individual-leaders">
          <div><p>Desempenho individual</p><h2>Artilharia e líderes</h2><span>Artilheiros, assistências, goleiros e cartões só entram quando houver números confiáveis para a competição.</span></div>
          {details.playerLeaders.length ? <div>{details.playerLeaders.map((leader) => <article key={`${leader.category}-${leader.name}`}><span>{leader.category}</span><strong>{leader.name}</strong><small>{[leader.team, leader.value].filter(Boolean).join(" · ")}</small></article>)}</div> : <p>Dados oficiais em atualização.</p>}
        </section>

        <section className="hub-section">
          <header className="hub-section__heading"><div><p>Próximos jogos</p><h2>Agenda</h2></div></header>
          {details.upcoming.length ? <div className="full-schedule__grid">{details.upcoming.slice(0, 12).map((event) => <EventCard key={event.id} score={event} />)}</div> : <div className="empty-card">Nenhum próximo jogo encontrado para esta competição no recorte atual.</div>}
        </section>

        <section className="hub-section">
          <header className="hub-section__heading"><div><p>Resultados recentes</p><h2>Últimos placares</h2></div></header>
          {details.recent.length ? <div className="full-schedule__grid">{details.recent.slice(0, 12).map((event) => <EventCard key={event.id} score={event} />)}</div> : <div className="empty-card">Os resultados aparecem aqui assim que as partidas forem encerradas.</div>}
        </section>

        <section className="hub-section">
          <header className="hub-section__heading"><div><p>Notícias relacionadas</p><h2>Contexto editorial</h2></div></header>
          {details.news.length ? <div className="competition-news">{details.news.map((item) => <Link key={item.id} href={item.internalUrl}><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className="empty-card">Notícias relacionadas aparecem aqui quando a editoria encontrar conteúdos da competição.</div>}
        </section>

        <section className="competition-guide">
          <div><p>Como acompanhar</p><h2>Continue na competição</h2><span>Use a agenda para navegar por data, abra a Central Ao Vivo durante as partidas e salve seus jogos favoritos.</span></div>
          <nav aria-label="Atalhos da competição"><Link href="/ao-vivo">Central Ao Vivo</Link><Link href={`/agenda?liga=${competition.id}`}>Agenda da liga</Link><Link href="/favoritos">Meus favoritos</Link></nav>
        </section>
      </div>
    </main>
  );
}
