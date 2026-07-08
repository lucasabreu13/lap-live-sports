import Link from "next/link";
import { EventCard } from "@/components/event-card";
import { LapHeader } from "@/components/lap-header";
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

function updateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Atualização recente";
  return `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(date)}`;
}

function sourceLabel(status: CompetitionDetails["sourceStatus"]) {
  if (status === "live") return "Fonte sincronizada";
  if (status === "stale") return "Última resposta válida em cache";
  return "Fonte em reconexão";
}

export function CompetitionCenter({ details }: { details: CompetitionDetails }) {
  const { competition } = details;
  const featured = details.live[0] || details.upcoming[0] || details.recent[0] || null;

  return (
    <main>
      <LapHeader activeSport="futebol" compact />
      <div className="shell competition-page">
        <nav className="article-breadcrumb" aria-label="Navegacao estrutural">
          <Link href="/">Início</Link>
          <span>›</span>
          <Link href="/agenda">Agenda</Link>
          <span>›</span>
          <span>{competition.name}</span>
        </nav>

        <section className="competition-hero">
          <div>
            <p>{competition.country}</p>
            <h1>{competition.name}</h1>
            <span>{sourceLabel(details.sourceStatus)} · ESPN scoreboard, Google News e cache resiliente da LAP.</span>
          </div>
          <aside>
            <strong>{details.live.length}</strong>
            <span>ao vivo</span>
            <small>{updateLabel(details.generatedAt)}</small>
          </aside>
        </section>

        {details.sourceNote && <p className="status-note">{details.sourceNote}</p>}

        <section className="competition-feature">
          <div>
            <p>Jogo em destaque</p>
            {featured ? (
              <>
                <h2>{featured.home.name} x {featured.away.name}</h2>
                {(featured.state === "post" ? featured.status : formatDateTime(featured.startTime)) && <span>{featured.state === "post" ? featured.status : formatDateTime(featured.startTime)}</span>}
                <Link className="competition-feature__button" href={`/jogos/${featured.sportId}/${featured.id}`}>Acompanhar jogo</Link>
              </>
            ) : (
              <>
                <h2>Aguardando agenda da fonte</h2>
                <span>A central fica pronta para receber jogos assim que o provedor publicar novos eventos.</span>
                <Link className="competition-feature__button" href="/agenda">Ver agenda geral</Link>
              </>
            )}
          </div>
          {featured ? <EventCard score={featured} /> : <div className="empty-card">Sem partida ativa neste recorte.</div>}
        </section>

        <section className="competition-grid">
          <article className="competition-panel competition-panel--wide">
            <header>
              <p>Classificacao</p>
              <h2>Tabela do recorte ao vivo</h2>
            </header>
            {details.table.length ? (
              <div className="competition-table-wrap">
                <table className="competition-table">
                  <thead>
                    <tr>
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
                      <tr key={row.team}>
                        <td>{row.logo && <img src={row.logo} alt="" width="22" height="22" />}<span>{row.team}</span></td>
                        <td>{row.points}</td>
                        <td>{row.played}</td>
                        <td>{row.wins}</td>
                        <td>{row.draws}</td>
                        <td>{row.losses}</td>
                        <td>{row.goalsFor - row.goalsAgainst}</td>
                        <td>{row.form.length ? row.form.join(" ") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="competition-panel__empty">A classificação aparece quando houver resultados suficientes no feed.</p>}
            <small>Quando a fonte oficial de standings estiver disponível, esta área pode ser substituída pela tabela completa da competição.</small>
          </article>

          <article className="competition-panel">
            <header>
              <p>Lideres</p>
              <h2>Indicadores</h2>
            </header>
            {details.leaders.length ? (
              <div className="competition-leaders">
                {details.leaders.map((leader) => <div key={leader.label}><span>{leader.label}</span><strong>{leader.team}</strong><small>{leader.value}</small></div>)}
              </div>
            ) : <p className="competition-panel__empty">Os líderes são calculados assim que houver jogos encerrados.</p>}
          </article>
        </section>

        <section className="hub-section">
          <header className="hub-section__heading"><div><p>Próximos jogos</p><h2>Agenda</h2></div></header>
          {details.upcoming.length ? <div className="full-schedule__grid">{details.upcoming.slice(0, 8).map((event) => <EventCard key={event.id} score={event} />)}</div> : <div className="empty-card">Nenhum próximo jogo encontrado para esta competição no recorte atual.</div>}
        </section>

        <section className="hub-section">
          <header className="hub-section__heading"><div><p>Resultados recentes</p><h2>Últimos placares</h2></div></header>
          {details.recent.length ? <div className="full-schedule__grid">{details.recent.slice(0, 8).map((event) => <EventCard key={event.id} score={event} />)}</div> : <div className="empty-card">Os resultados aparecem aqui assim que forem encerrados no feed.</div>}
        </section>

        <section className="hub-section">
          <header className="hub-section__heading"><div><p>Noticias relacionadas</p><h2>Contexto editorial</h2></div></header>
          {details.news.length ? <div className="competition-news">{details.news.map((item) => <Link key={item.id} href={item.internalUrl}><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className="empty-card">A editoria ainda não publicou matérias específicas desta competição.</div>}
        </section>
      </div>
    </main>
  );
}
