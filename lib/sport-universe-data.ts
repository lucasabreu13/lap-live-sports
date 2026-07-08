import { getCachedLivePayload } from "@/lib/free-live-data";
import { SPORTS, type NewsItem, type ScoreItem, type SportDefinition, type SportId } from "@/lib/live-data";

export type SportHubItem = { title: string; meta: string; value?: string; href?: string };
export type SportHubMetric = { label: string; value: string | number; hint: string };

export type SportUniverseDetails = {
  sport: SportDefinition;
  title: string;
  subtitle: string;
  metrics: SportHubMetric[];
  events: ScoreItem[];
  news: NewsItem[];
  ranking: SportHubItem[];
  calendar: SportHubItem[];
  entities: SportHubItem[];
  guide: SportHubItem[];
  generatedAt: string;
};

const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";

type AnyRecord = Record<string, unknown>;

type HubConfig = {
  title: string;
  subtitle: string;
  rankingTitle: string;
  entities: SportHubItem[];
  guide: SportHubItem[];
};

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? value as AnyRecord : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asText(value: unknown, fallback = "") {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return fallback;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 7000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function eventTime(event: ScoreItem) {
  if (!event.startTime) return 0;
  const value = new Date(event.startTime).getTime();
  return Number.isFinite(value) ? value : 0;
}

function sortEvents(events: ScoreItem[]) {
  return [...events].sort((a, b) => {
    const phase = (event: ScoreItem) => event.state === "in" ? 0 : event.state === "pre" ? 1 : event.state === "post" ? 2 : 3;
    const phaseDiff = phase(a) - phase(b);
    if (phaseDiff) return phaseDiff;
    return a.state === "post" ? eventTime(b) - eventTime(a) : eventTime(a) - eventTime(b);
  });
}

const nbaTeams: SportHubItem[] = [
  "Celtics", "Nets", "Knicks", "76ers", "Raptors", "Bulls", "Cavaliers", "Pistons", "Pacers", "Bucks", "Hawks", "Hornets", "Heat", "Magic", "Wizards", "Nuggets", "Timberwolves", "Thunder", "Trail Blazers", "Jazz", "Warriors", "Clippers", "Lakers", "Suns", "Kings", "Mavericks", "Rockets", "Grizzlies", "Pelicans", "Spurs",
].map((title) => ({ title, meta: "NBA", value: "time" }));

const configs: Partial<Record<SportId, HubConfig>> = {
  basquete: {
    title: "Basquete completo: NBA, calendário e times.",
    subtitle: "Central para jogos, resultados, notícias, franquias e próximos passos de estatísticas da temporada.",
    rankingTitle: "Conferências e campanha",
    entities: nbaTeams,
    guide: [
      { title: "Temporada regular", meta: "82 jogos por time", value: "out–abr" },
      { title: "Playoffs", meta: "mata-mata por conferência", value: "abr–jun" },
      { title: "NBA Finals", meta: "campeão da temporada", value: "jun" },
      { title: "Draft e Free Agency", meta: "mercado e novos talentos", value: "offseason" },
    ],
  },
  tenis: {
    title: "Tênis completo: torneios, rankings e Grand Slams.",
    subtitle: "ATP, WTA, jogos do dia, Grand Slams e notícias em uma central própria.",
    rankingTitle: "Ranking e torneios",
    entities: [
      { title: "Australian Open", meta: "Grand Slam", value: "hard" },
      { title: "Roland Garros", meta: "Grand Slam", value: "saibro" },
      { title: "Wimbledon", meta: "Grand Slam", value: "grama" },
      { title: "US Open", meta: "Grand Slam", value: "hard" },
      { title: "ATP Masters 1000", meta: "elite masculina", value: "ATP" },
      { title: "WTA 1000", meta: "elite feminina", value: "WTA" },
    ],
    guide: [
      { title: "Ranking ATP/WTA", meta: "ordem dos jogadores", value: "ranking" },
      { title: "Chaveamento", meta: "rodadas e confrontos", value: "draw" },
      { title: "Grand Slam", meta: "melhor de cinco no masculino", value: "major" },
      { title: "Calendário", meta: "torneios semanais", value: "tour" },
    ],
  },
  golfe: {
    title: "Golfe completo: PGA Tour, leaderboard e próximos torneios.",
    subtitle: "Calendário do PGA, torneio atual, leaderboard e notícias sem deixar a modalidade vazia.",
    rankingTitle: "Leaderboard PGA",
    entities: [
      { title: "PGA Tour", meta: "principal circuito", value: "EUA" },
      { title: "FedExCup", meta: "ranking da temporada", value: "pontos" },
      { title: "Masters", meta: "major", value: "abril" },
      { title: "PGA Championship", meta: "major", value: "maio" },
      { title: "U.S. Open", meta: "major", value: "junho" },
      { title: "The Open", meta: "major", value: "julho" },
    ],
    guide: [
      { title: "Torneios", meta: "normalmente quinta a domingo", value: "4 dias" },
      { title: "Leaderboard", meta: "classificação por tacadas", value: "score" },
      { title: "Corte", meta: "jogadores eliminados após rodadas iniciais", value: "cut" },
      { title: "Bolsa", meta: "premiação do torneio", value: "prize" },
    ],
  },
  volei: {
    title: "Vôlei completo: clubes, seleções e agenda.",
    subtitle: "Superliga, Liga das Nações, campeonatos internacionais, vôlei de praia e notícias relevantes.",
    rankingTitle: "Competições de vôlei",
    entities: [
      { title: "Superliga Masculina", meta: "Brasil", value: "clubes" },
      { title: "Superliga Feminina", meta: "Brasil", value: "clubes" },
      { title: "Liga das Nações", meta: "seleções", value: "VNL" },
      { title: "Mundial de Clubes", meta: "FIVB", value: "clubes" },
      { title: "Vôlei de praia", meta: "Elite 16/Challenge", value: "praia" },
      { title: "Sul-Americano", meta: "seleções/clubes", value: "regional" },
    ],
    guide: [
      { title: "Sets", meta: "melhor de cinco", value: "3x0–3x2" },
      { title: "Classificação", meta: "vitórias e pontos", value: "tabela" },
      { title: "Bloqueios/aces", meta: "estatísticas chave", value: "stats" },
      { title: "Seleção Brasileira", meta: "masculino e feminino", value: "BR" },
    ],
  },
  surfe: {
    title: "Surfe completo: etapas, ranking e bateria por bateria.",
    subtitle: "World Surf League, ranking, etapas do Championship Tour e notícias do circuito.",
    rankingTitle: "Circuito e ranking",
    entities: [
      { title: "WSL Championship Tour", meta: "elite mundial", value: "CT" },
      { title: "Challenger Series", meta: "acesso à elite", value: "CS" },
      { title: "Tahiti Pro", meta: "etapa icônica", value: "Teahupo'o" },
      { title: "Pipeline", meta: "Havaí", value: "reef" },
      { title: "Saquarema", meta: "Brasil", value: "etapa BR" },
      { title: "Finals", meta: "decisão do título", value: "top 5" },
    ],
    guide: [
      { title: "Baterias", meta: "confrontos por heat", value: "heat" },
      { title: "Notas", meta: "duas melhores ondas", value: "score" },
      { title: "Ranking", meta: "pontos por etapa", value: "WSL" },
      { title: "Janela", meta: "depende do swell", value: "mar" },
    ],
  },
};

const defaultEntities: Partial<Record<SportId, SportHubItem[]>> = {
  beisebol: ["Yankees", "Red Sox", "Dodgers", "Giants", "Cubs", "Cardinals", "Astros", "Mets", "Braves", "Phillies", "Blue Jays", "Padres"].map((title) => ({ title, meta: "MLB", value: "time" })),
  formula1: ["Red Bull", "Ferrari", "Mercedes", "McLaren", "Aston Martin", "Williams", "Alpine", "Haas", "Racing Bulls", "Kick Sauber"].map((title) => ({ title, meta: "equipe", value: "F1" })),
  mma: ["UFC", "Peso pesado", "Meio-pesado", "Peso médio", "Peso leve", "Peso pena", "Peso galo", "Peso mosca"].map((title) => ({ title, meta: "categoria", value: "ranking" })),
  rugby: ["Six Nations", "Rugby Championship", "Copa do Mundo", "Premiership", "Top 14", "United Rugby Championship"].map((title) => ({ title, meta: "competição", value: "rugby" })),
  criquete: ["Test cricket", "ODI", "T20", "IPL", "World Cup", "Ashes"].map((title) => ({ title, meta: "formato", value: "críquete" })),
  ciclismo: ["Tour de France", "Giro d'Italia", "La Vuelta", "Mundial", "Clássicas", "UCI WorldTour"].map((title) => ({ title, meta: "calendário", value: "ciclismo" })),
  natacao: ["Mundial", "Jogos Olímpicos", "50m livre", "100m livre", "200m medley", "revezamentos"].map((title) => ({ title, meta: "prova", value: "natação" })),
  atletismo: ["Diamond League", "Mundial", "100m", "Maratona", "Salto com vara", "Arremesso de peso"].map((title) => ({ title, meta: "prova", value: "atletismo" })),
  softball: ["NCAA", "World Cup", "Pan-Americano", "Liga japonesa", "seleções", "clubes"].map((title) => ({ title, meta: "competição", value: "softball" })),
};

function fallbackConfig(sport: SportDefinition): HubConfig {
  return {
    title: `${sport.name} completo: calendário, ranking e notícias.`,
    subtitle: sport.description || `Central personalizada para ${sport.name.toLowerCase()}, com eventos, notícias, entidades e próximos passos de estatísticas.`,
    rankingTitle: "Radar da modalidade",
    entities: defaultEntities[sport.id] ?? [
      { title: "Calendário", meta: sport.name, value: "eventos" },
      { title: "Ranking", meta: sport.name, value: "classificação" },
      { title: "Notícias", meta: sport.name, value: "contexto" },
      { title: "Atletas", meta: sport.name, value: "destaques" },
    ],
    guide: [
      { title: "Agenda", meta: "eventos e datas", value: "calendário" },
      { title: "Ranking", meta: "classificação oficial", value: "ranking" },
      { title: "Estatísticas", meta: "líderes da temporada", value: "stats" },
      { title: "Notícias", meta: "contexto editorial", value: "news" },
    ],
  };
}

function parsePgaExtras(json: unknown) {
  const root = asRecord(json);
  const league = asArray<AnyRecord>(root.leagues)[0];
  const calendar = asArray<AnyRecord>(asRecord(league).calendar)
    .map((item) => ({ title: asText(item.label), meta: `${asText(item.startDate).slice(0, 10)} → ${asText(item.endDate).slice(0, 10)}`, value: "PGA" }))
    .filter((item) => item.title)
    .slice(0, 8);

  const currentEvent = asArray<AnyRecord>(root.events)[0];
  const competition = asArray<AnyRecord>(asRecord(currentEvent).competitions)[0];
  const leaderboard = asArray<AnyRecord>(asRecord(competition).competitors)
    .slice(0, 12)
    .map((competitor) => {
      const athlete = asRecord(competitor.athlete);
      const rank = asRecord(competitor.curatedRank);
      return {
        title: asText(athlete.displayName, asText(athlete.fullName, "Jogador")),
        meta: asText(asRecord(currentEvent).name, "PGA Tour"),
        value: asText(competitor.score, asText(rank.current, "—")),
      };
    })
    .filter((item) => item.title && item.title !== "Jogador");
  return { calendar, leaderboard };
}

function parseTennisCalendar(json: unknown) {
  const events = asArray<AnyRecord>(asRecord(json).events);
  return events.slice(0, 12).map((event) => ({
    title: asText(event.name, asText(event.shortName, "Torneio")),
    meta: asText(event.date).slice(0, 10) || "Torneio em andamento",
    value: "jogo",
  })).filter((item) => item.title);
}

async function loadDirectExtras(sportId: SportId) {
  if (sportId === "golfe") {
    try {
      const response = await fetchWithTimeout(`${ESPN_BASE}/golf/pga/scoreboard`, { cache: "no-store", headers: { "user-agent": "LAP Sport Hub/1.0" } });
      if (response.ok) return parsePgaExtras(await response.json());
    } catch {
      return { calendar: [], leaderboard: [] };
    }
  }
  if (sportId === "tenis") {
    try {
      const response = await fetchWithTimeout(`${ESPN_BASE}/tennis/atp/scoreboard`, { cache: "no-store", headers: { "user-agent": "LAP Sport Hub/1.0" } });
      if (response.ok) return { calendar: parseTennisCalendar(await response.json()), leaderboard: [] };
    } catch {
      return { calendar: [], leaderboard: [] };
    }
  }
  return { calendar: [], leaderboard: [] };
}

export async function getSportUniverseDetails(sportId: SportId): Promise<SportUniverseDetails | null> {
  const sport = SPORTS.find((item) => item.id === sportId);
  if (!sport) return null;
  const [payload, extras] = await Promise.all([
    getCachedLivePayload().catch(() => null),
    loadDirectExtras(sportId),
  ]);
  const feed = payload?.feeds.find((item) => item.id === sportId);
  const config = configs[sportId] ?? fallbackConfig(sport);
  const events = sortEvents(feed?.scores ?? []);
  const news = [...(payload?.editorial ?? []), ...(feed?.news ?? [])]
    .filter((item) => item.sportId === sportId || item.title.toLowerCase().includes(sport.name.toLowerCase()))
    .slice(0, 8);
  const live = events.filter((event) => event.state === "in").length;
  const upcoming = events.filter((event) => event.state === "pre").length;

  return {
    sport,
    title: config.title,
    subtitle: config.subtitle,
    metrics: [
      { label: "Ao vivo", value: live, hint: "eventos agora" },
      { label: "Próximos", value: upcoming, hint: "na agenda" },
      { label: "Radar", value: events.length || config.entities.length, hint: events.length ? "eventos" : "itens mapeados" },
    ],
    events,
    news,
    ranking: extras.leaderboard.length ? extras.leaderboard : config.entities.slice(0, 8),
    calendar: extras.calendar.length ? extras.calendar : events.slice(0, 8).map((event) => ({ title: event.eventKind === "race" ? event.home.name : `${event.home.name} x ${event.away.name}`, meta: event.league, value: event.status })),
    entities: config.entities,
    guide: config.guide,
    generatedAt: payload?.generatedAt ?? new Date().toISOString(),
  };
}
