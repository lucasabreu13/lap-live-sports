import type { SportId } from "@/lib/live-data";

export type SportDataBlueprint = {
  sportId: SportId;
  primarySurface: string;
  eventUnit: string;
  liveSurface: string;
  rosterSurface: string;
  statsSurface: string;
  requiredData: string[];
  strongerProviders: string[];
  currentFallback: string;
};

export const SPORT_DATA_BLUEPRINTS: Record<SportId, SportDataBlueprint> = {
  futebol: {
    sportId: "futebol",
    primarySurface: "Grade de jogos por liga, rodada, tabela e mata-mata",
    eventUnit: "Partida",
    liveSurface: "Timeline com gols, cartões, substituições, VAR, pênaltis, acréscimos e placar",
    rosterSurface: "Escalação, titulares, reservas, formação, técnico, desfalques e suspensos",
    statsSurface: "Posse, finalizações, chutes no gol, escanteios, cartões, passes e xG quando houver fonte",
    requiredData: ["fixtures", "standings", "lineups", "play_by_play", "team_stats", "broadcasts", "injuries"],
    strongerProviders: ["API-SPORTS Football", "Sportradar Soccer", "SportsDataIO Soccer", "TheSportsDB para TV/highlights"],
    currentFallback: "ESPN Site API + Google News RSS + cache saudável da LAP",
  },
  "futebol-americano": {
    sportId: "futebol-americano",
    primarySurface: "Grade de jogos por semana, temporada, playoffs e conferência",
    eventUnit: "Jogo",
    liveSurface: "Drives, touchdowns, field goals, turnovers, sacks, quarters e placar por período",
    rosterSurface: "Depth chart, titulares, reservas, inativos, lesões e unidades ofensiva/defensiva/special teams",
    statsSurface: "Yards, first downs, turnovers, sacks, passing/rushing/receiving leaders e team stats",
    requiredData: ["schedule", "standings", "play_by_play", "boxscore", "depth_chart", "injuries", "broadcasts"],
    strongerProviders: ["SportsDataIO NFL", "Sportradar NFL", "API-SPORTS NFL & NCAA"],
    currentFallback: "ESPN Site API + Google News RSS + cache saudável da LAP",
  },
  tenis: {
    sportId: "tenis",
    primarySurface: "Calendário de torneios, chave, ordem de jogo e partidas por quadra",
    eventUnit: "Partida",
    liveSurface: "Sets, games, tiebreaks, break points e placar ponto a ponto quando disponível",
    rosterSurface: "Atletas, ranking, seed, confronto direto e chave do torneio",
    statsSurface: "Aces, dupla falta, primeiro saque, winners, erros não forçados e aproveitamento de break",
    requiredData: ["tournaments", "draws", "matches", "point_by_point", "player_stats", "rankings", "broadcasts"],
    strongerProviders: ["Sportradar Tennis", "SportsDataIO Tennis"],
    currentFallback: "ESPN Site API ATP + Google News RSS + cache saudável da LAP",
  },
  ciclismo: {
    sportId: "ciclismo",
    primarySurface: "Calendário de provas, etapas, pelotão, largada e classificação geral",
    eventUnit: "Prova/etapa",
    liveSurface: "Ataques, fugas, quedas, pontos de montanha, sprints intermediários e chegada",
    rosterSurface: "Ciclistas, equipes, camisas, abandonos e favoritos da etapa",
    statsSurface: "Classificação geral, etapa, montanha, pontos, juventude, tempo e diferenças",
    requiredData: ["race_calendar", "stages", "participants", "classifications", "live_incidents", "broadcasts"],
    strongerProviders: ["Sportradar Cycling", "Stats Perform/Opta Cycling", "feeds oficiais de organizadores"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  formula1: {
    sportId: "formula1",
    primarySurface: "Calendário de GPs, treinos, classificação, sprint e corrida",
    eventUnit: "Sessão/GP",
    liveSurface: "Voltas, bandeiras, safety car, pit stops, incidentes, classificação e diferenças",
    rosterSurface: "Grid, pilotos, equipes, posições de largada, pneus e penalidades",
    statsSurface: "Tempos por volta, setores, pit stops, pneus, posições e classificação do campeonato",
    requiredData: ["calendar", "sessions", "grid", "lap_by_lap", "pit_stops", "standings", "broadcasts"],
    strongerProviders: ["Sportradar Formula 1", "SportsDataIO F1", "API-SPORTS Formula-1", "Ergast/OpenF1 para histórico/complemento"],
    currentFallback: "ESPN Site API F1 + Google News RSS + cache saudável da LAP",
  },
  basquete: {
    sportId: "basquete",
    primarySurface: "Grade de jogos por liga, conferência, temporada e playoffs",
    eventUnit: "Jogo",
    liveSurface: "Placar por quarto, jogadas, faltas, tempos, runs e líderes do jogo",
    rosterSurface: "Quinteto inicial, banco, lesionados, rotação e técnico",
    statsSurface: "FG%, 3PT%, lances livres, rebotes, assistências, turnovers, plus/minus e líderes",
    requiredData: ["schedule", "standings", "play_by_play", "boxscore", "lineups", "injuries", "broadcasts"],
    strongerProviders: ["SportsDataIO NBA", "Sportradar NBA/Global Basketball", "API-SPORTS Basketball/NBA"],
    currentFallback: "ESPN Site API NBA + Google News RSS + cache saudável da LAP",
  },
  beisebol: {
    sportId: "beisebol",
    primarySurface: "Grade de jogos por liga, temporada, séries e playoffs",
    eventUnit: "Jogo",
    liveSurface: "Innings, corridas, hits, erros, arremessos, rebatidas e trocas de pitcher",
    rosterSurface: "Lineup, batting order, pitchers, bullpen, banco e lesionados",
    statsSurface: "R/H/E, ERA, WHIP, strikeouts, walks, batting stats e pitching stats",
    requiredData: ["schedule", "standings", "play_by_play", "boxscore", "lineups", "pitchers", "broadcasts"],
    strongerProviders: ["SportsDataIO MLB", "Sportradar MLB/Global Baseball", "API-SPORTS Baseball"],
    currentFallback: "ESPN Site API MLB + Google News RSS + cache saudável da LAP",
  },
  softball: {
    sportId: "softball",
    primarySurface: "Grade de jogos, torneios, séries e fases eliminatórias",
    eventUnit: "Jogo",
    liveSurface: "Innings, corridas, hits, erros, pitchers e eventos por entrada",
    rosterSurface: "Lineup, banco, pitchers e batting order",
    statsSurface: "R/H/E, rebatidas, pitching, walks, strikeouts e estatísticas por equipe",
    requiredData: ["schedule", "tournaments", "boxscore", "lineups", "play_by_play", "broadcasts"],
    strongerProviders: ["Sportradar General Baseball/Softball quando disponível", "feeds NCAA/ligas oficiais", "TheSportsDB para eventos/highlights"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  volei: {
    sportId: "volei",
    primarySurface: "Grade de jogos por competição, fase, rodada e seleção/clube",
    eventUnit: "Jogo",
    liveSurface: "Sets, parciais, pontos, viradas, match point e eventos da partida",
    rosterSurface: "Seis iniciais, banco, líbero, rotação, técnico e elenco",
    statsSurface: "Ataques, bloqueios, aces, erros, recepção, sets e líderes",
    requiredData: ["fixtures", "sets", "lineups", "team_stats", "play_by_play", "standings", "broadcasts"],
    strongerProviders: ["API-SPORTS Volleyball", "Sportradar Indoor/Beach Volleyball", "Statscore Volleyball"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  rugby: {
    sportId: "rugby",
    primarySurface: "Grade de jogos por torneio, rodada, fase e seleção/clube",
    eventUnit: "Jogo",
    liveSurface: "Tries, conversões, penalties, cartões, substituições e placar por tempo",
    rosterSurface: "XV inicial, banco, posições, técnico e desfalques",
    statsSurface: "Posse, território, tackles, scrums, lineouts, penalties e metros ganhos",
    requiredData: ["fixtures", "standings", "lineups", "play_by_play", "team_stats", "broadcasts"],
    strongerProviders: ["API-SPORTS Rugby", "Sportradar Rugby", "Statscore Rugby"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  criquete: {
    sportId: "criquete",
    primarySurface: "Calendário de séries, partidas, innings e competições",
    eventUnit: "Partida",
    liveSurface: "Overs, wickets, boundaries, innings, run rate e scorecard bola a bola",
    rosterSurface: "XI inicial, ordem de batting, bowlers, reservas e toss",
    statsSurface: "Runs, wickets, overs, strike rate, economy, partnerships e scorecard completo",
    requiredData: ["fixtures", "scorecard", "ball_by_ball", "lineups", "standings", "broadcasts"],
    strongerProviders: ["Sportradar Cricket", "Cricbuzz/CricketData provider", "ESPNcricinfo como referência editorial"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  mma: {
    sportId: "mma",
    primarySurface: "Calendário de eventos, card principal, preliminares e lutas por categoria",
    eventUnit: "Luta/evento",
    liveSurface: "Rounds, knockdowns, quedas, finalização, decisão, método e tempo oficial",
    rosterSurface: "Lutadores, corners, cartel, categoria, ranking e substituições no card",
    statsSurface: "Golpes significativos, quedas, tentativas de finalização, controle e round stats",
    requiredData: ["events", "fight_card", "fighter_profiles", "round_stats", "results", "broadcasts"],
    strongerProviders: ["SportsDataIO UFC/MMA", "Sportradar MMA", "API-SPORTS MMA"],
    currentFallback: "ESPN Site API UFC + Google News RSS + cache saudável da LAP",
  },
  golfe: {
    sportId: "golfe",
    primarySurface: "Calendário de torneios, rodadas, grupos de saída e leaderboard",
    eventUnit: "Torneio/rodada",
    liveSurface: "Leaderboard, buracos, birdies, bogeys, cortes, tee times e rodada em andamento",
    rosterSurface: "Jogadores, grupos, tee times, país e ranking",
    statsSurface: "Score total, rodada, par, posição, driving, putting e fairways quando disponível",
    requiredData: ["tournaments", "leaderboard", "tee_times", "player_stats", "rounds", "broadcasts"],
    strongerProviders: ["SportsDataIO PGA/Golf", "Sportradar Golf", "TheSportsDB para eventos/highlights"],
    currentFallback: "ESPN Site API PGA + Google News RSS + cache saudável da LAP",
  },
  natacao: {
    sportId: "natacao",
    primarySurface: "Calendário de provas, baterias, semifinais e finais",
    eventUnit: "Prova/bateria",
    liveSurface: "Tempos, parciais, raias, recordes e resultado por bateria",
    rosterSurface: "Atletas, raias, país, séries e classificação",
    statsSurface: "Tempo final, splits, recordes, ranking, reação e diferença para líder",
    requiredData: ["meet_calendar", "heats", "entries", "results", "splits", "broadcasts"],
    strongerProviders: ["feeds World Aquatics/organizadores", "Sportradar Olympics/Swimming quando licenciado", "TheSportsDB para calendário/highlights"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  atletismo: {
    sportId: "atletismo",
    primarySurface: "Calendário de provas, baterias, finais e meetings",
    eventUnit: "Prova",
    liveSurface: "Marcas, tentativas, tempos, vento, voltas, parciais e resultado",
    rosterSurface: "Atletas, raias, séries, país e ranking",
    statsSurface: "Tempo/marca, recordes, splits, vento, tentativas e classificação",
    requiredData: ["meet_calendar", "events", "entries", "results", "splits", "rankings", "broadcasts"],
    strongerProviders: ["feeds World Athletics/organizadores", "Sportradar Olympics/Athletics quando licenciado", "TheSportsDB para calendário/highlights"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
  surfe: {
    sportId: "surfe",
    primarySurface: "Calendário de etapas, baterias, rounds e ranking",
    eventUnit: "Bateria",
    liveSurface: "Ondas, notas, prioridade, somatório, heats e classificação em tempo real",
    rosterSurface: "Surfistas, baterias, seed, país e ranking",
    statsSurface: "Melhores ondas, somatório, notas por onda, ranking e avanço de fase",
    requiredData: ["tour_calendar", "heats", "athletes", "wave_scores", "rankings", "broadcasts"],
    strongerProviders: ["feeds oficiais WSL/ISA quando disponíveis", "Sportradar Olympics/Surfing quando licenciado", "TheSportsDB para eventos/highlights"],
    currentFallback: "Google News RSS + estrutura LAP aguardando provedor de calendário/resultados",
  },
};

export function getSportDataBlueprint(sportId: SportId) {
  return SPORT_DATA_BLUEPRINTS[sportId];
}

export function getAllSportDataBlueprints() {
  return Object.values(SPORT_DATA_BLUEPRINTS);
}
