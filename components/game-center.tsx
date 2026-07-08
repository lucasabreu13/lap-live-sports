"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { FavoriteButton } from "@/components/favorite-button";
import { LapHeader } from "@/components/lap-header";
import type { GameDetails, GameLineup, GameTimelineItem, SportId } from "@/lib/live-data";
import { SPORTS } from "@/lib/live-data";
import { canDisplayScore, displayScoreValue, reconciliationMessage, scoreSeparator } from "@/lib/score-integrity";
import styles from "./game-center.module.css";

type Tab = "resumo" | "linha" | "estatisticas" | "escalacoes";

type SportExperience = {
  eventLabel: string;
  participantLabel: string;
  lineupsTitle: string;
  lineupsEmpty: string;
  startersLabel: string;
  benchLabel: string;
  formationLabel: string;
  startLimit: number | null;
  timelineTitle: string;
  timelineEmpty: string;
};

const SPORT_EXPERIENCE: Record<SportId, SportExperience> = {
  futebol: { eventLabel: "Partida", participantLabel: "Times", lineupsTitle: "Escalações", lineupsEmpty: "Escalações, reservas e formação aparecem assim que a fonte oficial publicar.", startersLabel: "Titulares", benchLabel: "Reservas", formationLabel: "Formação", startLimit: 11, timelineTitle: "Linha do tempo", timelineEmpty: "Gols, cartões, substituições e demais lances confirmados entram aqui durante o jogo." },
  "futebol-americano": { eventLabel: "Jogo", participantLabel: "Equipes", lineupsTitle: "Elencos e depth chart", lineupsEmpty: "Titulares, reservas, inativos e depth chart aparecem quando a fonte entregar a lista do jogo.", startersLabel: "Titulares / principais", benchLabel: "Reservas / rotação", formationLabel: "Unidade", startLimit: 11, timelineTitle: "Drives e jogadas", timelineEmpty: "Touchdowns, field goals, turnovers, drives e períodos entram aqui durante o jogo." },
  tenis: { eventLabel: "Jogo", participantLabel: "Atletas", lineupsTitle: "Atletas e chave", lineupsEmpty: "Tênis não usa escalação. A LAP mostra atletas, chave, sets e estatísticas quando a fonte publicar.", startersLabel: "Atletas", benchLabel: "Equipe técnica / adicionais", formationLabel: "Chave", startLimit: 1, timelineTitle: "Sets e games", timelineEmpty: "Sets, games, tiebreaks e momentos decisivos aparecem aqui quando a fonte publicar." },
  ciclismo: { eventLabel: "Prova", participantLabel: "Competidores", lineupsTitle: "Pelotão e equipes", lineupsEmpty: "Participantes, equipes, classificação e abandonos aparecem quando a fonte da prova disponibilizar.", startersLabel: "Participantes", benchLabel: "Equipe / reservas", formationLabel: "Etapa", startLimit: null, timelineTitle: "Eventos da prova", timelineEmpty: "Ataques, quedas, pontos de montanha, sprints e chegada aparecem aqui quando disponíveis." },
  formula1: { eventLabel: "Evento", participantLabel: "Pilotos", lineupsTitle: "Grid e pilotos", lineupsEmpty: "Grid, pilotos, equipes, pneus e pit stops aparecem quando a fonte publicar esses dados.", startersLabel: "Grid / pilotos", benchLabel: "Equipes / reservas", formationLabel: "Grid", startLimit: 20, timelineTitle: "Voltas e incidentes", timelineEmpty: "Largada, bandeiras, pit stops, safety car e classificação entram aqui quando a fonte publicar." },
  basquete: { eventLabel: "Jogo", participantLabel: "Times", lineupsTitle: "Quintetos e banco", lineupsEmpty: "Quintetos, banco e rotação aparecem quando a fonte oficial publicar o boxscore.", startersLabel: "Quinteto inicial", benchLabel: "Banco", formationLabel: "Quinteto", startLimit: 5, timelineTitle: "Lances e períodos", timelineEmpty: "Cestas, faltas, quartos, viradas e eventos do placar entram aqui durante o jogo." },
  beisebol: { eventLabel: "Jogo", participantLabel: "Times", lineupsTitle: "Lineup e arremessadores", lineupsEmpty: "Lineup, banco, pitchers e batting order aparecem quando a fonte publicar o boxscore.", startersLabel: "Lineup inicial", benchLabel: "Banco / bullpen", formationLabel: "Batting order", startLimit: 9, timelineTitle: "Innings e jogadas", timelineEmpty: "Runs, hits, erros, trocas de arremessador e innings aparecem aqui durante o jogo." },
  softball: { eventLabel: "Jogo", participantLabel: "Times", lineupsTitle: "Lineup e banco", lineupsEmpty: "Lineup, banco e pitchers aparecem quando a fonte da partida publicar.", startersLabel: "Lineup inicial", benchLabel: "Banco", formationLabel: "Batting order", startLimit: 9, timelineTitle: "Innings e jogadas", timelineEmpty: "Runs, hits, erros e innings aparecem aqui durante o jogo." },
  volei: { eventLabel: "Jogo", participantLabel: "Times", lineupsTitle: "Titulares e banco", lineupsEmpty: "Titulares, banco e rotação aparecem quando a fonte publicar a súmula.", startersLabel: "Seis iniciais", benchLabel: "Banco", formationLabel: "Rotação", startLimit: 6, timelineTitle: "Sets e pontos", timelineEmpty: "Sets, parciais, viradas e pontos decisivos aparecem aqui durante o jogo." },
  rugby: { eventLabel: "Jogo", participantLabel: "Times", lineupsTitle: "XV inicial e banco", lineupsEmpty: "XV inicial, banco e substituições aparecem quando a fonte oficial publicar.", startersLabel: "XV inicial", benchLabel: "Banco", formationLabel: "Formação", startLimit: 15, timelineTitle: "Linha do tempo", timelineEmpty: "Tries, conversões, penalties, cartões e substituições aparecem aqui durante o jogo." },
  criquete: { eventLabel: "Jogo", participantLabel: "Times", lineupsTitle: "XI inicial e banco", lineupsEmpty: "XI inicial, reservas, innings e batting order aparecem quando a fonte publicar.", startersLabel: "XI inicial", benchLabel: "Reservas", formationLabel: "Batting order", startLimit: 11, timelineTitle: "Overs e wickets", timelineEmpty: "Overs, wickets, boundaries e innings aparecem aqui quando disponíveis." },
  mma: { eventLabel: "Luta", participantLabel: "Lutadores", lineupsTitle: "Card e corners", lineupsEmpty: "MMA não usa escalação. A LAP mostra card, corners, rounds e método quando a fonte publicar.", startersLabel: "Lutadores", benchLabel: "Corners / card", formationLabel: "Categoria", startLimit: 2, timelineTitle: "Rounds e eventos", timelineEmpty: "Rounds, knockdowns, finalização, decisão e método de vitória aparecem aqui quando disponíveis." },
  golfe: { eventLabel: "Torneio", participantLabel: "Jogadores", lineupsTitle: "Leaderboard e grupos", lineupsEmpty: "Leaderboard, grupos de saída e classificação aparecem quando a fonte do torneio publicar.", startersLabel: "Jogadores", benchLabel: "Grupos / tee times", formationLabel: "Leaderboard", startLimit: null, timelineTitle: "Buracos e classificação", timelineEmpty: "Birdies, bogeys, rodada e leaderboard aparecem aqui quando disponíveis." },
  natacao: { eventLabel: "Prova", participantLabel: "Atletas", lineupsTitle: "Séries e raias", lineupsEmpty: "Séries, raias e participantes aparecem quando a fonte oficial publicar.", startersLabel: "Atletas", benchLabel: "Séries", formationLabel: "Raia", startLimit: null, timelineTitle: "Parciais e resultado", timelineEmpty: "Parciais, tempos e resultado aparecem aqui quando disponíveis." },
  atletismo: { eventLabel: "Prova", participantLabel: "Atletas", lineupsTitle: "Séries e participantes", lineupsEmpty: "Séries, baterias, participantes e finalistas aparecem quando a fonte publicar.", startersLabel: "Atletas", benchLabel: "Séries / baterias", formationLabel: "Prova", startLimit: null, timelineTitle: "Marcas e resultado", timelineEmpty: "Tentativas, marcas, parciais e resultado aparecem aqui quando disponíveis." },
  surfe: { eventLabel: "Bateria", participantLabel: "Surfistas", lineupsTitle: "Baterias e surfistas", lineupsEmpty: "Baterias, surfistas e notas aparecem quando a fonte publicar.", startersLabel: "Surfistas", benchLabel: "Baterias", formationLabel: "Heat", startLimit: null, timelineTitle: "Ondas e notas", timelineEmpty: "Ondas, notas e classificação da bateria aparecem aqui quando disponíveis." },
};

function sportExperience(sportId: SportId) {
  return SPORT_EXPERIENCE[sportId] ?? SPORT_EXPERIENCE.futebol;
}

function sportName(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId)?.name ?? sportId;
}

function formattedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function formattedUpdate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Atualização recente";
  return `Atualizado às ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(date)}`;
}

function phase(event: GameDetails["event"]) {
  if (event.integrity === "reconciling") return "EM RECONCILIAÇÃO";
  if (event.state === "in") return "AO VIVO";
  if (event.state === "post") return "ENCERRADO";
  if (event.state === "pre") return "EM BREVE";
  return event.status;
}

function formatCompetition(event: GameDetails["event"], worldCup = false) {
  if (worldCup) return "Copa do Mundo 2026";
  return event.league.replace(/-/g, " ");
}

function eventTitle(event: GameDetails["event"]) {
  return event.eventKind === "race" ? event.home.name : `${event.home.name} x ${event.away.name}`;
}

function summaryIntro(details: GameDetails, worldCup: boolean) {
  const { event } = details;
  const competition = formatCompetition(event, worldCup);
  if (event.state === "in") return `${eventTitle(event)} está ao vivo pela ${competition}. A LAP acompanha placar, status, estatísticas e eventos confirmados pela fonte antes de exibir qualquer atualização.`;
  if (event.state === "post") return `${eventTitle(event)} foi encerrado pela ${competition}. O resumo reúne placar final, principais dados disponíveis, contexto e próximos pontos de consulta.`;
  return `${eventTitle(event)} está na agenda da ${competition}. Antes do início, a LAP concentra horário, local, transmissão, favoritos, escalações e dados oficiais assim que forem publicados.`;
}

function phasePlan(details: GameDetails) {
  const event = details.event;
  const experience = sportExperience(event.sportId);
  if (event.state === "in") {
    return {
      title: "Acompanhar agora",
      items: [
        `Seguir ${experience.timelineTitle.toLowerCase()} com lances confirmados pela fonte.`,
        "Conferir estatísticas e mudanças de placar sem dado inventado.",
        `Abrir ${experience.lineupsTitle.toLowerCase()} para ver participantes, titulares, banco ou equivalentes da modalidade.`,
      ],
    };
  }
  if (event.state === "post") {
    return {
      title: "Depois do jogo",
      items: [
        "Revisar placar final e status oficial da partida.",
        "Consultar estatísticas finais quando o boxscore estiver consolidado.",
        "Usar a linha do tempo para entender os principais eventos do jogo.",
      ],
    };
  }
  return {
    title: "Antes do jogo",
    items: [
      "Confirmar horário, local e transmissão assim que a fonte publicar.",
      `Acompanhar ${experience.lineupsTitle.toLowerCase()} quando a lista oficial sair.`,
      "Favoritar este evento para receber alertas quando houver atualização real.",
    ],
  };
}

function factCards(details: GameDetails, worldCup: boolean) {
  const { event } = details;
  return [
    { label: "Situação", value: phase(event), hint: event.status || "Status operacional" },
    { label: "Competição", value: formatCompetition(event, worldCup), hint: event.round || sportName(event.sportId) },
    { label: "Quando", value: formattedDate(event.startTime) || "Data não informada", hint: event.state === "in" ? "Em andamento" : event.state === "post" ? "Evento encerrado" : "Agenda confirmada" },
    { label: "Transmissão", value: event.broadcast || "Transmissão não confirmada", hint: event.broadcast ? "Canal/streaming informado pela fonte" : "Aparece aqui quando a fonte publicar TV ou streaming" },
    { label: "Local", value: event.venue || "Local não informado", hint: event.venue ? "Informação da fonte" : "Estádio, arena ou circuito ainda indisponível" },
    { label: "Atualização", value: formattedUpdate(details.generatedAt), hint: event.state === "in" ? "Polling a cada 15s nesta tela" : "Polling a cada 30s nesta tela" },
  ];
}

function coverageCards(details: GameDetails) {
  const experience = sportExperience(details.event.sportId);
  return [
    { label: "Transmissão", available: Boolean(details.event.broadcast), value: details.event.broadcast || "Pendente", hint: details.event.broadcast ? "Canal/streaming recebido" : "Aguardando TV ou streaming da fonte" },
    { label: experience.timelineTitle, available: details.timeline.length > 0, value: details.timeline.length ? `${details.timeline.length} eventos` : "Pendente", hint: details.timeline.length ? "Eventos do jogo carregados" : "Aguardando play-by-play" },
    { label: "Estatísticas", available: details.teamStats.length > 0, value: details.teamStats.length ? `${details.teamStats.length} blocos` : "Pendente", hint: details.teamStats.length ? "Boxscore disponível" : "Aguardando estatísticas" },
    { label: experience.lineupsTitle, available: details.lineups.length > 0, value: details.lineups.length ? `${details.lineups.length} listas` : "Pendente", hint: details.lineups.length ? "Participantes carregados" : "Aguardando lista oficial" },
    { label: "Integridade", available: details.event.integrity === "verified", value: details.event.integrity === "verified" ? "Verificado" : "Reconciliação", hint: details.event.integrity === "verified" ? "Placar liberado para exibição" : "A LAP preserva dados até reconciliar" },
  ];
}

function timelineIcon(item: GameTimelineItem) {
  const text = item.text.toLowerCase();
  if (item.scoring || text.includes("gol") || text.includes("goal") || text.includes("touchdown") || text.includes("try")) return "⚡";
  if (text.includes("cartão") || text.includes("card") || text.includes("yellow") || text.includes("red")) return "🟨";
  if (text.includes("substit") || text.includes("entra") || text.includes("sai")) return "🔁";
  if (text.includes("intervalo") || text.includes("halftime")) return "⏸";
  if (text.includes("fim") || text.includes("final")) return "🏁";
  if (text.includes("início") || text.includes("start")) return "▶️";
  return "•";
}

function timelineKind(item: GameTimelineItem) {
  const text = item.text.toLowerCase();
  if (item.scoring) return "Placar";
  if (text.includes("cartão") || text.includes("card")) return "Disciplina";
  if (text.includes("substit")) return "Troca";
  if (text.includes("intervalo") || text.includes("halftime")) return "Intervalo";
  if (text.includes("fim") || text.includes("final")) return "Final";
  return "Lance";
}

function splitLineup(lineup: GameLineup, experience: SportExperience) {
  const uniquePlayers = [...new Set(lineup.players.filter(Boolean))];
  if (!experience.startLimit || uniquePlayers.length <= experience.startLimit) return { starters: uniquePlayers, bench: [] };
  return { starters: uniquePlayers.slice(0, experience.startLimit), bench: uniquePlayers.slice(experience.startLimit) };
}

function LineupCard({ lineup, experience }: { lineup: GameLineup; experience: SportExperience }) {
  const { starters, bench } = splitLineup(lineup, experience);
  return (
    <article className={styles.lineupCard}>
      <header><div><p>Equipe</p><h3>{lineup.team}</h3></div><span>{starters.length + bench.length}</span></header>
      <div className={styles.formationBox}><p>{experience.formationLabel}</p><strong>Não informada pela fonte</strong><span>A LAP não inventa formação. Quando o provedor entregar, ela entra aqui.</span></div>
      <div className={styles.lineupColumns}>
        <section><h4>{experience.startersLabel}</h4>{starters.length ? <ol>{starters.map((player) => <li key={`${lineup.team}-starter-${player}`}>{player}</li>)}</ol> : <p>Não informado.</p>}</section>
        <section><h4>{experience.benchLabel}</h4>{bench.length ? <ol>{bench.map((player) => <li key={`${lineup.team}-bench-${player}`}>{player}</li>)}</ol> : <p>Banco ou lista complementar ainda não informada.</p>}</section>
      </div>
    </article>
  );
}

function GameSummary({ details, worldCup }: { details: GameDetails; worldCup: boolean }) {
  const reconciling = reconciliationMessage(details.event);
  const experience = sportExperience(details.event.sportId);
  const cards = factCards(details, worldCup);
  const coverage = coverageCards(details);
  const plan = phasePlan(details);
  return (
    <section className="game-panel game-panel--summary">
      {reconciling && <div className="game-integrity-panel"><p>Verificação de dados</p><strong>Em reconciliação</strong><span>{reconciling}</span></div>}
      <div className={styles.summaryLead}><p>{experience.eventLabel} · {experience.participantLabel}</p><h2>Resumo completo</h2><span>{summaryIntro(details, worldCup)}</span></div>
      <div className={styles.summaryGrid}>{cards.map((card) => <article key={card.label}><p>{card.label}</p><h3>{card.value}</h3><span>{card.hint}</span></article>)}</div>
      <div className={styles.coverageBlock}>
        <div className={styles.coverageIntro}><p>Cobertura dos dados</p><h3>O que a fonte já entregou</h3><span>A LAP mostra cada bloco conforme a fonte disponibiliza. Informação ausente fica marcada como pendente, sem preencher dado falso.</span></div>
        <div className={styles.coverageGrid}>{coverage.map((item) => <article key={item.label} className={`${styles.coverageItem} ${item.available ? styles.coverageAvailable : ""}`}><p>{item.label}</p><strong>{item.value}</strong><span>{item.hint}</span></article>)}</div>
      </div>
      <div className={styles.phaseBlock}><p>{plan.title}</p><ul>{plan.items.map((item) => <li key={item}>{item}</li>)}</ul></div>
      {details.headlines.length ? <div className={styles.focusBlock}><p>Contexto LAP</p><h3>O que está em foco</h3><ul>{details.headlines.map((headline) => <li key={headline}>{headline}</li>)}</ul></div> : null}
      {details.notes.length ? <div className={styles.infoBlock}><p>Informações da fonte</p><ul>{details.notes.map((note) => <li key={note}>{note}</li>)}</ul></div> : null}
    </section>
  );
}

function GameTimeline({ details }: { details: GameDetails }) {
  const experience = sportExperience(details.event.sportId);
  return <section className="game-panel"><div className={styles.panelHeader}><p>{experience.eventLabel}</p><h2>{experience.timelineTitle}</h2><span>Eventos confirmados entram em ordem cronológica reversa, sem lance inventado.</span></div>{details.timeline.length ? <ol className={styles.timelineList}>{details.timeline.map((item) => <li key={item.id} className={item.scoring ? styles.timelineScore : undefined}><div className={styles.timelineStamp}><strong>{item.clock || "•"}</strong><span>{item.period ? `Período ${item.period}` : "Atualização"}</span></div><div className={styles.timelineIcon} aria-hidden>{timelineIcon(item)}</div><div className={styles.timelineBody}><div><span>{timelineKind(item)}</span>{item.team && <small>{item.team}</small>}</div><p>{item.text}</p></div>{item.homeScore !== null && item.awayScore !== null && <strong className={styles.timelineScoreline}>{item.homeScore} × {item.awayScore}</strong>}</li>)}</ol> : <p className="game-panel__empty">{experience.timelineEmpty}</p>}</section>;
}

function GameStats({ details }: { details: GameDetails }) {
  return <section className="game-panel"><div className={styles.panelHeader}><p>Boxscore</p><h2>Estatísticas</h2><span>Somente números publicados pela fonte são exibidos.</span></div>{details.teamStats.length ? <div className="game-stats">{details.teamStats.map((team) => <article className="game-stats__team" key={team.team}><header>{team.logo && <img src={team.logo} alt="" width="28" height="28" />}<h3>{team.team}</h3></header><dl>{team.stats.map((stat) => <div key={`${team.team}-${stat.label}`}><dt>{stat.label}</dt><dd>{stat.value}</dd></div>)}</dl></article>)}</div> : <p className="game-panel__empty">As estatísticas desta partida ainda não foram disponibilizadas.</p>}</section>;
}

function GameLineups({ details }: { details: GameDetails }) {
  const experience = sportExperience(details.event.sportId);
  return <section className="game-panel"><div className={styles.panelHeader}><p>{experience.participantLabel}</p><h2>{experience.lineupsTitle}</h2><span>Estrutura universal por modalidade: titulares, banco, grid, card, leaderboard ou participantes conforme o esporte.</span></div>{details.lineups.length ? <div className={styles.lineupsGrid}>{details.lineups.map((team) => <LineupCard key={team.team} lineup={team} experience={experience} />)}</div> : <p className="game-panel__empty">{experience.lineupsEmpty}</p>}</section>;
}

function GameTabContent({ details, tab, worldCup }: { details: GameDetails; tab: Tab; worldCup: boolean }) {
  if (tab === "linha") return <GameTimeline details={details} />;
  if (tab === "estatisticas") return <GameStats details={details} />;
  if (tab === "escalacoes") return <GameLineups details={details} />;
  return <GameSummary details={details} worldCup={worldCup} />;
}

export function GameCenter({ initialDetails, worldCup }: { initialDetails: GameDetails; worldCup: boolean }) {
  const [details, setDetails] = useState(initialDetails);
  const [tab, setTab] = useState<Tab>("resumo");
  const [refreshing, setRefreshing] = useState(false);
  const event = details.event;
  const eventUrl = `/jogos/${event.sportId}/${event.id}${worldCup ? "?torneio=copa-2026" : ""}`;
  const showScore = canDisplayScore(event);
  const reconciling = reconciliationMessage(event);
  const eventDate = formattedDate(event.startTime);
  const updateLabel = formattedUpdate(details.generatedAt);

  async function refresh() {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/games/${event.sportId}/${event.id}${worldCup ? "?torneio=copa-2026" : ""}`, { cache: "no-store" });
      if (response.ok) setDetails(await response.json() as GameDetails);
    } finally { setRefreshing(false); }
  }

  useEffect(() => {
    const delay = details.event.state === "in" ? 15_000 : 30_000;
    const interval = window.setInterval(() => void refresh(), delay);
    return () => window.clearInterval(interval);
  }, [details.event.state, event.id, worldCup]);

  useEffect(() => {
    if (!("EventSource" in window)) return;
    const source = new EventSource("/api/live/stream");
    const onScore = (message: Event) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as { eventId?: string };
        if (payload.eventId === event.id) void refresh();
      } catch { /* Atualização periódica continua ativa. */ }
    };
    source.addEventListener("score", onScore);
    return () => source.close();
  }, [event.id]);

  const tabs = useMemo(() => [["resumo", "Resumo"], ["linha", "Linha do tempo"], ["estatisticas", "Estatísticas"], ["escalacoes", sportExperience(event.sportId).lineupsTitle]] as Array<[Tab, string]>, [event.sportId]);

  return (
    <main>
      <LapHeader activeSport={event.sportId} />
      <div className="shell game-page">
        <nav className="article-breadcrumb" aria-label="Navegação estrutural"><Link href="/">Início</Link><span>›</span>{worldCup && <><Link href="/copa-2026">Copa 2026</Link><span>›</span></>}<Link href={`/modalidades/${event.sportId}`}>{sportName(event.sportId)}</Link></nav>
        <section className="game-hero">
          <div className="game-hero__meta"><span className={event.state === "in" && !reconciling ? "live-label" : "status-label"}>{phase(event)}</span><span>{event.round || event.league.replace(/-/g, " ")}</span><FavoriteButton id={`event:${event.sportId}:${event.id}`} type="event" label={eventTitle(event)} href={eventUrl} /></div>
          <p className="game-hero__competition">{formatCompetition(event, worldCup)}</p>
          <div className="scoreboard-hero"><article><img src={event.home.logo || "/icons/lap-icon.svg"} alt="" width="72" height="72"/><h1>{event.home.name}</h1>{event.home.record && <p>{event.home.record}</p>}</article><div className="scoreboard-hero__score"><strong className={showScore ? "" : "scoreboard-hero__score--pending"}>{showScore ? <>{displayScoreValue(event, "home")}<span>{scoreSeparator(event)}</span>{displayScoreValue(event, "away")}</> : <span>{scoreSeparator(event)}</span>}</strong>{(showScore && event.state === "post" ? event.status : eventDate) && <p>{showScore && event.state === "post" ? event.status : eventDate}</p>}</div><article><img src={event.away.logo || "/icons/lap-icon.svg"} alt="" width="72" height="72"/><h1>{event.away.name}</h1>{event.away.record && <p>{event.away.record}</p>}</article></div>
          {reconciling && <div className="game-integrity-panel game-integrity-panel--hero"><p>Verificação de dados</p><strong>Em reconciliação</strong><span>{reconciling}</span></div>}
          <div className="game-hero__footer"><span>{updateLabel}</span><button className="refresh-button" type="button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Atualizando" : "Atualizar jogo"}</button></div>
          <section className="game-snapshot" aria-label="Resumo operacional da partida"><article><p>Status</p><strong>{phase(event)}</strong><span>{event.status}</span></article>{event.venue && <article><p>Local</p><strong>{event.venue}</strong><span>Informação fornecida pela fonte</span></article>}<article><p>Transmissão</p><strong>{event.broadcast || "Não confirmada"}</strong><span>{event.broadcast ? "Canal/streaming publicado" : "TV ou streaming entram quando a fonte publicar"}</span></article><article><p>Atualização</p><strong>{updateLabel}</strong><span>{event.state === "in" ? "Polling a cada 15s" : "Polling a cada 30s"}</span></article><Link href="/agenda" className="game-snapshot__link">Ver agenda →</Link></section>
        </section>
        <div className="game-tabs" role="tablist" aria-label="Dados da partida">{tabs.map(([id, label]) => <button key={id} type="button" role="tab" aria-selected={tab === id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</div>
        <GameTabContent details={details} tab={tab} worldCup={worldCup} />
      </div>
    </main>
  );
}
