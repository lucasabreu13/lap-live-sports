"use client";

import { useMemo, useState } from "react";
import type {
  CollegeDivision,
  CollegeFootballHub,
  CollegeGame,
  CollegeTeam,
  CollegeTeamDetail,
} from "@/lib/college-football-data";
import styles from "./college-football-center.module.css";

const DIVISION_ORDER: CollegeDivision[] = ["fbs", "fcs", "d2", "d3"];

function formatDate(value: string | null) {
  if (!value) return "Data a confirmar";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data a confirmar";
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function gameStateLabel(game: CollegeGame) {
  if (game.state === "in") return "AO VIVO";
  if (game.state === "post") return "FINAL";
  return formatDate(game.date);
}

function scoreLabel(game: CollegeGame) {
  if (game.state === "pre") return "vs";
  return `${game.away.score ?? "-"} × ${game.home.score ?? "-"}`;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function TeamLogo({ team, size = 44 }: { team: Pick<CollegeTeam, "logo" | "shortName">; size?: number }) {
  if (!team.logo) return <span className={styles.logoFallback} style={{ width: size, height: size }}>{team.shortName.slice(0, 2).toUpperCase()}</span>;
  return <img className={styles.teamLogo} src={team.logo} width={size} height={size} alt={`Logo ${team.shortName}`} />;
}

function GameCard({ game }: { game: CollegeGame }) {
  return (
    <article className={styles.gameCard}>
      <div className={styles.gameMeta}>
        <span className={game.state === "in" ? styles.live : ""}>{gameStateLabel(game)}</span>
        <span>{game.broadcast || "Transmissão não publicada"}</span>
      </div>
      <div className={styles.matchup}>
        <div>
          {game.away.logo ? <img src={game.away.logo} alt="" width={34} height={34} /> : <span className={styles.miniLogo}>A</span>}
          <span><strong>{game.away.name}</strong><small>{game.away.record || ""}</small></span>
        </div>
        <b>{scoreLabel(game)}</b>
        <div>
          {game.home.logo ? <img src={game.home.logo} alt="" width={34} height={34} /> : <span className={styles.miniLogo}>H</span>}
          <span><strong>{game.home.name}</strong><small>{game.home.record || ""}</small></span>
        </div>
      </div>
      <footer>{game.venue || "Estádio ainda não publicado pela fonte"}</footer>
    </article>
  );
}

function TeamDetailPanel({ detail, loading, error, onClose }: { detail: CollegeTeamDetail | null; loading: boolean; error: string | null; onClose: () => void }) {
  if (!detail && !loading && !error) return null;

  return (
    <div className={styles.detailBackdrop} role="presentation" onMouseDown={onClose}>
      <aside className={styles.detailPanel} role="dialog" aria-modal="true" aria-label="Detalhes do time" onMouseDown={(event) => event.stopPropagation()}>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Fechar detalhes">×</button>
        {loading && <div className={styles.detailLoading}>Buscando elenco, estádio, calendário e títulos nas fontes reais…</div>}
        {error && <div className={styles.detailError}>{error}</div>}
        {detail && !loading && (
          <>
            <header className={styles.detailHeader}>
              <TeamLogo team={detail.team} size={72} />
              <div>
                <span>{detail.team.division.toUpperCase()} · {detail.team.conference || "Conferência não publicada"}</span>
                <h2>{detail.team.name}</h2>
                <p>{detail.record || "Recorde da temporada ainda não publicado"}</p>
              </div>
            </header>

            <section className={styles.detailFacts}>
              <article><span>Estádio</span><strong>{detail.venue.name || "Não publicado"}</strong><small>{[detail.venue.city, detail.venue.state].filter(Boolean).join(", ") || "Localização não publicada"}</small></article>
              <article><span>Capacidade</span><strong>{detail.venue.capacity ? detail.venue.capacity.toLocaleString("pt-BR") : "—"}</strong><small>{detail.venue.indoor === null ? "Tipo não informado" : detail.venue.indoor ? "Coberto" : "Aberto"}</small></article>
              <article><span>Títulos nacionais</span><strong>{detail.titleCount}</strong><small>{detail.titles.length ? detail.titles.map((item) => item.season).slice(0, 4).join(", ") : "Nenhum título encontrado no histórico da divisão"}</small></article>
              <article><span>Elenco carregado</span><strong>{detail.roster.length}</strong><small>Jogadores retornados pela fonte</small></article>
            </section>

            <section className={styles.detailSection}>
              <div className={styles.sectionTitle}><div><span>Roster</span><h3>Jogadores</h3></div><small>{detail.roster.length} atletas</small></div>
              {detail.roster.length ? (
                <div className={styles.rosterGrid}>
                  {detail.roster.map((player) => (
                    <article key={player.id} className={styles.playerCard}>
                      {player.headshot ? <img src={player.headshot} alt={player.name} width={50} height={50} /> : <span className={styles.playerAvatar}>{player.jersey || "#"}</span>}
                      <div><strong>{player.name}</strong><span>{[player.position, player.jersey ? `#${player.jersey}` : null, player.classYear].filter(Boolean).join(" · ") || "Dados de posição não publicados"}</span><small>{[player.height, player.weight, player.hometown].filter(Boolean).join(" · ")}</small></div>
                    </article>
                  ))}
                </div>
              ) : <p className={styles.empty}>A fonte não publicou o roster deste time neste momento.</p>}
            </section>

            <section className={styles.detailSection}>
              <div className={styles.sectionTitle}><div><span>Season {new Date().getFullYear()}</span><h3>Calendário</h3></div><small>{detail.schedule.length} jogos</small></div>
              {detail.schedule.length ? (
                <div className={styles.scheduleList}>
                  {detail.schedule.map((game) => (
                    <article key={game.id}>
                      <div>{game.opponentLogo ? <img src={game.opponentLogo} alt="" width={30} height={30} /> : null}<strong>{game.homeAway === "away" ? "@ " : game.homeAway === "neutral" ? "vs " : "vs "}{game.opponent}</strong></div>
                      <span>{game.state === "post" ? `${game.teamScore ?? "-"} × ${game.opponentScore ?? "-"}` : formatDate(game.date)}</span>
                      <small>{game.venue || game.status}</small>
                    </article>
                  ))}
                </div>
              ) : <p className={styles.empty}>O calendário 2026 ainda não foi publicado para este time na fonte consultada.</p>}
            </section>

            <section className={styles.detailSection}>
              <div className={styles.sectionTitle}><div><span>História</span><h3>Títulos nacionais</h3></div><small>{detail.titleCount}</small></div>
              {detail.titles.length ? (
                <div className={styles.titleList}>
                  {detail.titles.map((title) => <article key={`${title.season}-${title.champion}`}><strong>{title.season}</strong><span>{title.champion}</span><small>{[title.score, title.runnerUp ? `vice: ${title.runnerUp}` : null, title.selector].filter(Boolean).join(" · ")}</small></article>)}
                </div>
              ) : <p className={styles.empty}>Nenhum título foi associado a este programa no histórico oficial retornado para a divisão.</p>}
            </section>

            <p className={styles.sourceNote}>Dados exibidos somente quando retornados por ESPN e NCAA. Campos ausentes permanecem vazios; a LAP não preenche informações esportivas por estimativa.</p>
          </>
        )}
      </aside>
    </div>
  );
}

export function CollegeFootballCenter({ hub }: { hub: CollegeFootballHub }) {
  const [division, setDivision] = useState<CollegeDivision>("fbs");
  const [query, setQuery] = useState("");
  const [conference, setConference] = useState("todas");
  const [selectedTeam, setSelectedTeam] = useState<CollegeTeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const current = hub.divisions[division];
  const conferences = useMemo(() => Array.from(new Set(current.teams.map((team) => team.conference).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b)), [current.teams]);
  const filteredTeams = useMemo(() => {
    const normalized = normalize(query.trim());
    return current.teams.filter((team) => {
      const matchesQuery = !normalized || normalize(`${team.name} ${team.location} ${team.nickname} ${team.abbreviation}`).includes(normalized);
      const matchesConference = conference === "todas" || team.conference === conference;
      return matchesQuery && matchesConference;
    });
  }, [current.teams, query, conference]);

  const games = useMemo(() => [...current.games].sort((a, b) => {
    const stateWeight = (state: CollegeGame["state"]) => state === "in" ? 0 : state === "pre" ? 1 : 2;
    const byState = stateWeight(a.state) - stateWeight(b.state);
    if (byState) return byState;
    return new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime();
  }), [current.games]);

  const champion = current.championshipHistory[0] || null;
  const conferenceCount = new Set(current.teams.map((team) => team.conference).filter(Boolean)).size;

  async function openTeam(team: CollegeTeam) {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedTeam(null);
    try {
      const response = await fetch(`/api/college-football/team/${encodeURIComponent(team.id)}?division=${team.division}`, { cache: "no-store" });
      const payload = await response.json() as CollegeTeamDetail | { error?: string };
      if (!response.ok || !("team" in payload)) throw new Error("error" in payload && payload.error ? payload.error : "Falha ao carregar os dados do time.");
      setSelectedTeam(payload);
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : "Falha ao carregar os dados do time.");
    } finally {
      setDetailLoading(false);
    }
  }

  function changeDivision(next: CollegeDivision) {
    setDivision(next);
    setConference("todas");
    setQuery("");
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div className="shell">
          <div className={styles.heroGrid}>
            <div>
              <span className={styles.kicker}>LAP · COLLEGE FOOTBALL</span>
              <h1>College football inteiro.<br />Uma central.</h1>
              <p>FBS, FCS, Division II e Division III em uma página dedicada: jogos, universidades, estádios, elencos e história de campeonatos. Sem mock e sem preencher lacunas com dados inventados.</p>
              <div className={styles.sourcePills}><span>ESPN · times, jogos, rosters e venues</span><span>NCAA · histórico de campeões</span></div>
            </div>
            <aside className={styles.heroChampion}>
              <span>Atual campeão · {current.label}</span>
              <strong>{champion?.champion || "Histórico indisponível"}</strong>
              <small>{champion ? `Temporada ${champion.season}${champion.score ? ` · ${champion.score}` : ""}` : "Aguardando retorno da fonte"}</small>
            </aside>
          </div>
        </div>
      </section>

      <div className="shell">
        <nav className={styles.divisionTabs} aria-label="Divisões do college football">
          {DIVISION_ORDER.map((item) => <button type="button" key={item} className={division === item ? styles.activeTab : ""} onClick={() => changeDivision(item)}><strong>{hub.divisions[item].label}</strong><span>{hub.divisions[item].teams.length || "—"} times</span></button>)}
        </nav>

        <section className={styles.metrics}>
          <article><span>Programas</span><strong>{current.teams.length || "—"}</strong><small>retornados pela fonte nesta divisão</small></article>
          <article><span>Conferências</span><strong>{conferenceCount || "—"}</strong><small>identificadas nos dados disponíveis</small></article>
          <article><span>Jogos carregados</span><strong>{current.games.length}</strong><small>janela dos próximos 70 dias</small></article>
          <article><span>Campeões no histórico</span><strong>{current.championshipHistory.length}</strong><small>temporadas/linhas retornadas pela NCAA</small></article>
        </section>

        <section className={styles.section}>
          <header className={styles.heading}><div><span>Scoreboard · {current.label}</span><h2>Ao vivo e próximos jogos</h2></div><p>Horários convertidos para Brasília.</p></header>
          {games.length ? <div className={styles.gamesGrid}>{games.slice(0, 12).map((game) => <GameCard key={game.id} game={game} />)}</div> : <div className={styles.emptyWide}>Nenhum jogo foi retornado pela fonte para a janela atual. A página mantém o estado vazio em vez de criar partidas fictícias.</div>}
        </section>

        <section className={styles.section}>
          <header className={styles.heading}><div><span>Team explorer</span><h2>Todos os times de {current.label}</h2></div><p>Clique em uma universidade para abrir estádio, roster, calendário e títulos sem sair da página.</p></header>
          <div className={styles.filters}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar universidade, nickname ou sigla" aria-label="Buscar time" />
            <select value={conference} onChange={(event) => setConference(event.target.value)} aria-label="Filtrar por conferência"><option value="todas">Todas as conferências</option>{conferences.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <span>{filteredTeams.length} resultados</span>
          </div>
          {filteredTeams.length ? (
            <div className={styles.teamGrid}>
              {filteredTeams.map((team) => (
                <button type="button" key={team.id} className={styles.teamCard} onClick={() => void openTeam(team)}>
                  <TeamLogo team={team} />
                  <span><strong>{team.shortName}</strong><small>{team.conference || current.label}</small></span>
                  <b>→</b>
                </button>
              ))}
            </div>
          ) : <div className={styles.emptyWide}>Nenhum time real corresponde aos filtros selecionados.</div>}
        </section>

        <section className={styles.section}>
          <header className={styles.heading}><div><span>Championship history</span><h2>Campeões nacionais · {current.label}</h2></div><p>Histórico retornado pela NCAA; no FBS, o campo de seletor preserva CFP/BCS e organizações históricas quando publicado.</p></header>
          {current.championshipHistory.length ? (
            <div className={styles.historyTableWrap}>
              <table className={styles.historyTable}>
                <thead><tr><th>Temporada</th><th>Campeão</th><th>Treinador</th><th>Resultado / vice</th><th>Local / seletor</th></tr></thead>
                <tbody>{current.championshipHistory.map((row) => <tr key={`${row.season}-${row.champion}-${row.selector || ""}`}><td>{row.season}</td><td><strong>{row.champion}</strong></td><td>{row.coach || "—"}</td><td>{[row.score, row.runnerUp].filter(Boolean).join(" · ") || "—"}</td><td>{[row.site, row.selector].filter(Boolean).join(" · ") || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <div className={styles.emptyWide}>O histórico da divisão não respondeu agora. Nenhum campeão foi preenchido manualmente.</div>}
        </section>

        <section className={styles.dataPolicy}>
          <div><span>POLÍTICA DE DADOS LAP</span><h2>Real primeiro. Vazio quando a fonte não entrega.</h2></div>
          <p>Esta central não usa jogadores, jogos, títulos, estádios ou resultados fictícios. Dados operacionais vêm da ESPN e o histórico de campeonatos é consultado via dados originados no NCAA.com. Quando um campo não está disponível, ele aparece como não publicado — nunca como estimativa.</p>
        </section>
      </div>

      <TeamDetailPanel detail={selectedTeam} loading={detailLoading} error={detailError} onClose={() => { setSelectedTeam(null); setDetailError(null); }} />
    </main>
  );
}
