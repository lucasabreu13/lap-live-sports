import { createHash } from "node:crypto";
import { getPublishedEditorialArticles, type EditorialArticle } from "@/lib/editorial-store";

export type SportId =
  | "futebol"
  | "futebol-americano"
  | "tenis"
  | "ciclismo"
  | "formula1"
  | "basquete"
  | "beisebol"
  | "softball"
  | "volei"
  | "rugby"
  | "criquete"
  | "mma"
  | "golfe"
  | "natacao"
  | "atletismo"
  | "surfe";

export type SportDefinition = {
  id: SportId;
  name: string;
  icon: string;
  query: string;
  espnPath?: string;
  description?: string;
};

export type FootballCompetition = {
  id: string;
  name: string;
  country: string;
  espnPath: string;
  tier: "global" | "major" | "regional";
};

export type NewsItem = {
  id: string;
  kind: "brief" | "editorial";
  slug: string;
  sportId: SportId;
  title: string;
  excerpt: string;
  source: string;
  url: string | null;
  publishedAt: string | null;
  internalUrl: string;
};

export type ScoreItem = {
  id: string;
  sportId: SportId;
  league: string;
  round: string | null;
  venue: string | null;
  broadcast: string | null;
  status: string;
  state: "pre" | "in" | "post" | "unknown";
  startTime: string | null;
  isWorldCup?: boolean;
  providerPath?: string | null;
  competitionId?: string | null;
  country?: string | null;
  eventKind?: "match" | "race";
  home: { name: string; score: string | null; logo?: string | null; record?: string | null };
  away: { name: string; score: string | null; logo?: string | null; record?: string | null };
};

export type FeedSourceStatus = "live" | "stale" | "unavailable";

export type SportFeed = SportDefinition & {
  news: NewsItem[];
  scores: ScoreItem[];
  sourceStatus: FeedSourceStatus;
  sourceNote: string | null;
};

export type FootballCoverage = {
  competitions: FootballCompetition[];
  activeCompetitionIds: string[];
  sourceStatus: FeedSourceStatus;
  sourceNote: string | null;
};

export type CompetitionTableRow = {
  team: string;
  logo: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
  form: string[];
};

export type CompetitionLeader = {
  label: string;
  team: string;
  value: string;
};

export type CompetitionDetails = {
  competition: FootballCompetition;
  live: ScoreItem[];
  upcoming: ScoreItem[];
  recent: ScoreItem[];
  table: CompetitionTableRow[];
  leaders: CompetitionLeader[];
  news: NewsItem[];
  sourceStatus: FeedSourceStatus;
  sourceNote: string | null;
  generatedAt: string;
};

export type WorldCupFeed = {
  name: string;
  events: ScoreItem[];
  sourceStatus: "ok" | "unavailable";
};

export type LivePayload = {
  generatedAt: string;
  refreshSeconds: number;
  editorial: NewsItem[];
  feeds: SportFeed[];
  football: FootballCoverage;
  worldCup: WorldCupFeed;
};

export type LiveWebhookPatch = {
  eventId: string;
  sportId?: SportId;
  state?: ScoreItem["state"];
  status?: string;
  homeScore?: string | number | null;
  awayScore?: string | number | null;
  occurredAt?: string;
};

export type GameTimelineItem = {
  id: string;
  period: string | null;
  clock: string | null;
  text: string;
  scoring: boolean;
  homeScore: string | null;
  awayScore: string | null;
  team: string | null;
};

export type GameTeamStat = {
  team: string;
  logo: string | null;
  stats: Array<{ label: string; value: string }>;
};

export type GameLineup = {
  team: string;
  players: string[];
};

export type GameDetails = {
  event: ScoreItem;
  timeline: GameTimelineItem[];
  teamStats: GameTeamStat[];
  lineups: GameLineup[];
  headlines: string[];
  notes: string[];
  sourceStatus: "ok" | "unavailable";
  generatedAt: string;
};

export const FOOTBALL_COMPETITIONS: FootballCompetition[] = [
  { id: "brasileirao-a", name: "Brasileirão Série A", country: "Brasil", espnPath: "soccer/bra.1", tier: "global" },
  { id: "brasileirao-b", name: "Brasileirão Série B", country: "Brasil", espnPath: "soccer/bra.2", tier: "major" },
  { id: "copa-do-brasil", name: "Copa do Brasil", country: "Brasil", espnPath: "soccer/bra.copa_do_brasil", tier: "major" },
  { id: "libertadores", name: "Copa Libertadores", country: "América do Sul", espnPath: "soccer/conmebol.libertadores", tier: "global" },
  { id: "sul-americana", name: "Copa Sul-Americana", country: "América do Sul", espnPath: "soccer/conmebol.sudamericana", tier: "major" },
  { id: "premier-league", name: "Premier League", country: "Inglaterra", espnPath: "soccer/eng.1", tier: "global" },
  { id: "champions", name: "UEFA Champions League", country: "Europa", espnPath: "soccer/uefa.champions", tier: "global" },
  { id: "la-liga", name: "LaLiga", country: "Espanha", espnPath: "soccer/esp.1", tier: "global" },
  { id: "serie-a", name: "Serie A", country: "Itália", espnPath: "soccer/ita.1", tier: "global" },
  { id: "bundesliga", name: "Bundesliga", country: "Alemanha", espnPath: "soccer/ger.1", tier: "global" },
  { id: "ligue-1", name: "Ligue 1", country: "França", espnPath: "soccer/fra.1", tier: "global" },
  { id: "eredivisie", name: "Eredivisie", country: "Holanda", espnPath: "soccer/ned.1", tier: "major" },
  { id: "primeira-liga", name: "Liga Portugal", country: "Portugal", espnPath: "soccer/por.1", tier: "major" },
  { id: "mls", name: "MLS", country: "Estados Unidos", espnPath: "soccer/usa.1", tier: "major" },
  { id: "liga-mx", name: "Liga MX", country: "México", espnPath: "soccer/mex.1", tier: "major" },
  { id: "liga-profesional", name: "Liga Profesional", country: "Argentina", espnPath: "soccer/arg.1", tier: "major" },
  { id: "uruguai", name: "Campeonato Uruguaio", country: "Uruguai", espnPath: "soccer/uru.1", tier: "regional" },
  { id: "chile", name: "Campeonato Chileno", country: "Chile", espnPath: "soccer/chi.1", tier: "regional" },
  { id: "colombia", name: "Liga Colombiana", country: "Colômbia", espnPath: "soccer/col.1", tier: "regional" },
  { id: "equador", name: "LigaPro Equador", country: "Equador", espnPath: "soccer/ecu.1", tier: "regional" },
  { id: "turquia", name: "Süper Lig", country: "Turquia", espnPath: "soccer/tur.1", tier: "regional" },
  { id: "belgica", name: "Jupiler Pro League", country: "Bélgica", espnPath: "soccer/bel.1", tier: "regional" },
  { id: "escocia", name: "Scottish Premiership", country: "Escócia", espnPath: "soccer/sco.1", tier: "regional" },
  { id: "japao", name: "J1 League", country: "Japão", espnPath: "soccer/jpn.1", tier: "regional" },
  { id: "australia", name: "A-League", country: "Austrália", espnPath: "soccer/aus.1", tier: "regional" },
];

export const SPORTS: SportDefinition[] = [
  { id: "futebol", name: "Futebol", icon: "⚽", query: "futebol OR soccer Brasil", espnPath: "soccer", description: "Brasileirão, Copa do Brasil, Europa e futebol mundial" },
  { id: "futebol-americano", name: "NFL", icon: "🏈", query: "NFL OR futebol americano", espnPath: "football/nfl", description: "Temporada, playoffs e jogos da NFL" },
  { id: "formula1", name: "Fórmula 1", icon: "🏎️", query: "Fórmula 1 OR Formula 1", espnPath: "racing/f1", description: "Agenda de GPs, treinos e corridas" },
  { id: "basquete", name: "Basquete", icon: "🏀", query: "basquete OR basketball NBA", espnPath: "basketball/nba" },
  { id: "tenis", name: "Tênis", icon: "🎾", query: "tênis OR tennis", espnPath: "tennis/atp" },
  { id: "ciclismo", name: "Ciclismo", icon: "🚴", query: "ciclismo OR cycling" },
  { id: "beisebol", name: "Beisebol", icon: "⚾", query: "beisebol OR baseball MLB", espnPath: "baseball/mlb" },
  { id: "softball", name: "Softball", icon: "🥎", query: "softball" },
  { id: "volei", name: "Vôlei", icon: "🏐", query: "vôlei OR volleyball" },
  { id: "rugby", name: "Rugby", icon: "🏉", query: "rugby" },
  { id: "criquete", name: "Críquete", icon: "🏏", query: "críquete OR cricket" },
  { id: "mma", name: "MMA", icon: "🥊", query: "MMA OR UFC", espnPath: "mma/ufc" },
  { id: "golfe", name: "Golfe", icon: "⛳", query: "golfe OR golf PGA", espnPath: "golf/pga" },
  { id: "natacao", name: "Natação", icon: "🏊", query: "natação OR swimming" },
  { id: "atletismo", name: "Atletismo", icon: "🏃", query: "atletismo OR athletics" },
  { id: "surfe", name: "Surfe", icon: "🏄", query: "surfe OR surfing" },
];

const RSS_BASE = "https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419";
const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports";
const CACHE_TTL_MS = 25_000;
const STALE_WINDOW_MS = 20 * 60_000;
const FOOTBALL_FETCH_LIMIT = 14;
const WORLD_CUP_PATH = "soccer/fifa.world";
const WORLD_CUP_WINDOW = "20260611-20260719";

let liveCache: { expiresAt: number; payload: LivePayload } | null = null;
let lastHealthyPayload: { cachedAt: number; payload: LivePayload } | null = null;
const liveSubscribers = new Set<(event: { type: "score"; patch: LiveWebhookPatch } | { type: "snapshot"; payload: LivePayload }) => void>();

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", ndash: "–", mdash: "—", hellip: "…",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", copy: "©", reg: "®", trade: "™",
  aacute: "á", agrave: "à", acirc: "â", atilde: "ã", auml: "ä", aring: "å", eacute: "é", egrave: "è", ecirc: "ê", euml: "ë",
  iacute: "í", igrave: "ì", icirc: "î", iuml: "ï", oacute: "ó", ograve: "ò", ocirc: "ô", otilde: "õ", ouml: "ö",
  uacute: "ú", ugrave: "ù", ucirc: "û", uuml: "ü", ccedil: "ç", ntilde: "ñ",
  Aacute: "Á", Agrave: "À", Acirc: "Â", Atilde: "Ã", Auml: "Ä", Eacute: "É", Egrave: "È", Ecirc: "Ê", Euml: "Ë",
  Iacute: "Í", Igrave: "Ì", Icirc: "Î", Iuml: "Ï", Oacute: "Ó", Ograve: "Ò", Ocirc: "Ô", Otilde: "Õ", Ouml: "Ö",
  Uacute: "Ú", Ugrave: "Ù", Ucirc: "Û", Uuml: "Ü", Ccedil: "Ç", Ntilde: "Ñ",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
}

function decodeHtmlEntities(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-zA-Z]+);/g, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) {
      const codePoint = Number.parseInt(lower.slice(2), 16);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    if (lower.startsWith("#")) {
      const codePoint = Number.parseInt(lower.slice(1), 10);
      return Number.isFinite(codePoint) && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : match;
    }
    return NAMED_HTML_ENTITIES[entity] ?? NAMED_HTML_ENTITIES[lower] ?? match;
  });
}

export function repairMojibake(value: string) {
  let normalized = value
    .replace(/â€™/g, "’")
    .replace(/â€˜/g, "‘")
    .replace(/â€œ/g, "“")
    .replace(/â€/g, "”")
    .replace(/â€¦/g, "…")
    .replace(/â€“/g, "–")
    .replace(/â€”/g, "—")
    .replace(/Â\s/g, " ");

  if (/(?:Ã.|Â.)/.test(normalized)) {
    try {
      const repaired = Buffer.from(normalized, "latin1").toString("utf8");
      if (!repaired.includes("�")) normalized = repaired;
    } catch {
      // Mantém o texto se a recuperação de charset não for segura.
    }
  }

  return normalized.normalize("NFC");
}

function decodeHtml(value: string) {
  return repairMojibake(decodeHtmlEntities(stripCdata(value))).trim();
}

function tagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeHtml(match[1]) : "";
}

function toPlainText(value: string) {
  return decodeHtml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function excerptFromDescription(value: string, title: string) {
  const text = toPlainText(value)
    .replace(/^\s*[^-]+\s*-\s*/, "")
    .replace(title, "")
    .trim();

  if (!text) return "Acompanhe os principais fatos e o impacto desta história no cenário esportivo.";
  return text.length > 280 ? `${text.slice(0, 277).trimEnd()}…` : text;
}

function stableSlug(seed: string) {
  return createHash("sha256").update(seed).digest("hex").slice(0, 18);
}

type ArticleTransport = Pick<NewsItem, "slug" | "sportId" | "title" | "excerpt" | "source" | "url" | "publishedAt">;

function encodeArticleTransport(item: ArticleTransport) {
  return Buffer.from(JSON.stringify(item), "utf8").toString("base64url");
}

export function decodeArticleTransport(value: string | undefined): ArticleTransport | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<ArticleTransport>;
    if (
      typeof parsed.slug !== "string" ||
      typeof parsed.sportId !== "string" ||
      typeof parsed.title !== "string" ||
      typeof parsed.excerpt !== "string" ||
      typeof parsed.source !== "string" ||
      typeof parsed.url !== "string" ||
      !SPORTS.some((sport) => sport.id === parsed.sportId)
    ) return null;

    const originalUrl = new URL(parsed.url);
    if (originalUrl.protocol !== "https:" && originalUrl.protocol !== "http:") return null;

    return {
      slug: parsed.slug,
      sportId: parsed.sportId as SportId,
      title: repairMojibake(parsed.title),
      excerpt: repairMojibake(parsed.excerpt),
      source: repairMojibake(parsed.source),
      url: originalUrl.toString(),
      publishedAt: typeof parsed.publishedAt === "string" ? parsed.publishedAt : null,
    };
  } catch {
    return null;
  }
}

function parseGoogleNewsRss(xml: string, sportId: SportId): NewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];

  return items.slice(0, 6).flatMap((item, index) => {
    const title = tagValue(item, "title");
    const url = tagValue(item, "link");
    const source = tagValue(item, "source") || "Google Notícias";
    const publishedAt = tagValue(item, "pubDate") || null;
    const excerpt = excerptFromDescription(tagValue(item, "description"), title);
    if (!title || !url) return [];

    const slug = stableSlug(`${url}|${source}|${title}`);
    const baseItem: ArticleTransport = { slug, sportId, title, excerpt, source, url, publishedAt };
    return [{
      id: `${sportId}-news-${index}-${slug}`,
      kind: "brief" as const,
      ...baseItem,
      internalUrl: `/materias/${slug}?d=${encodeArticleTransport(baseItem)}`,
    }];
  });
}

function editorialToNews(article: EditorialArticle): NewsItem | null {
  if (!SPORTS.some((sport) => sport.id === article.sportId)) return null;
  return {
    id: `editorial-${article.id}`,
    kind: "editorial",
    slug: article.slug,
    sportId: article.sportId as SportId,
    title: article.title,
    excerpt: article.summary,
    source: article.sourceName || "LAP",
    url: article.sourceUrl,
    publishedAt: article.publishedAt || article.createdAt,
    internalUrl: `/materias/${article.slug}`,
  };
}

function fallbackEditorialItems(): NewsItem[] {
  const seed: Array<Pick<NewsItem, "slug" | "sportId" | "title" | "excerpt">> = [
    { slug: "guia-brasileirao-e-futebol-mundial", sportId: "futebol", title: "Guia LAP: Brasileirão e futebol mundial em uma só agenda", excerpt: "Use a agenda para alternar entre Brasil, Europa, América do Sul e as principais competições internacionais." },
    { slug: "agenda-formula-1", sportId: "formula1", title: "Fórmula 1 na LAP: agenda de GPs, sessões e resultados", excerpt: "A central de Fórmula 1 foi preparada para reunir os próximos Grandes Prêmios e o status de cada etapa." },
    { slug: "nfl-na-lap", sportId: "futebol-americano", title: "NFL na LAP: jogos, favoritos e alertas da temporada", excerpt: "Siga a NFL na página de modalidades e salve os confrontos que quiser acompanhar em tempo real." },
    { slug: "como-usar-alertas-lap", sportId: "futebol", title: "Como personalizar sua LAP com favoritos e alertas", excerpt: "Marque esportes e jogos para concentrar sua agenda e receber atualizações diretamente no navegador." },
  ];
  return seed.map((item, index) => {
    const transport: ArticleTransport = {
      ...item,
      source: "LAP Guia",
      url: "https://lap-live-sports.vercel.app/agenda",
      publishedAt: new Date(Date.now() - index * 60 * 60_000).toISOString(),
    };
    return {
      id: `lap-guide-${item.slug}`,
      kind: "editorial" as const,
      ...transport,
      internalUrl: `/materias/${item.slug}?d=${encodeArticleTransport(transport)}`,
    };
  });
}

async function fetchWithTimeout(url: string, init?: RequestInit, timeoutMs = 9_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function loadNews(sport: SportDefinition): Promise<NewsItem[]> {
  const url = `${RSS_BASE}&q=${encodeURIComponent(`${sport.query} when:2d`)}`;
  const response = await fetchWithTimeout(url, { cache: "no-store", headers: { "user-agent": "LAP Sports Dashboard/4.0" } });
  if (!response.ok) throw new Error(`RSS ${response.status}`);
  return parseGoogleNewsRss(await response.text(), sport.id);
}

function scoreFromCompetitor(competitor: unknown) {
  const item = asRecord(competitor);
  const team = asRecord(item.team);
  const records = asArray<Record<string, unknown>>(item.records);
  const record = records.map((entry) => asText(entry.summary)).find(Boolean) ?? null;
  return {
    name: repairMojibake(asText(team.displayName, asText(team.shortDisplayName, asText(asRecord(item.athlete).displayName, "Sem identificação")))),
    score: item.score !== undefined && item.score !== "" ? String(item.score) : null,
    logo: asText(team.logo) || null,
    record,
  };
}

function parseScoreboard(
  json: unknown,
  sport: Pick<SportDefinition, "id" | "name" | "espnPath">,
  options?: { isWorldCup?: boolean; providerPath?: string; competition?: FootballCompetition },
): ScoreItem[] {
  const events = asArray<Record<string, unknown>>(asRecord(json).events);
  return events.flatMap((event) => {
    const competition = asArray<Record<string, unknown>>(event.competitions)[0];
    const competitors = asArray<Record<string, unknown>>(competition?.competitors);
    const home = competitors.find((item) => item.homeAway === "home");
    const away = competitors.find((item) => item.homeAway === "away");
    if (!home || !away) return [];

    const statusType = asRecord(asRecord(event.status).type);
    const rawState = asText(statusType.state);
    const state: ScoreItem["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
    const season = asRecord(event.season);
    const competitionLeague = asRecord(event.league);
    const venue = asRecord(competition?.venue);
    const broadcasts = asArray<Record<string, unknown>>(competition?.geoBroadcasts);
    const broadcastMedia = asRecord(broadcasts[0]?.media);
    const week = asRecord(event.week);

    return [{
      id: asText(event.id),
      sportId: sport.id,
      league: repairMojibake(options?.competition?.name || asText(season.slug, asText(competitionLeague.name, sport.name))),
      round: repairMojibake(asText(asRecord(season.type).name, asText(week.text))) || null,
      venue: repairMojibake(asText(venue.fullName)) || null,
      broadcast: repairMojibake(asText(broadcastMedia.shortName)) || null,
      status: repairMojibake(asText(statusType.shortDetail, asText(statusType.detail, "Agenda confirmada"))),
      state,
      startTime: typeof event.date === "string" ? event.date : null,
      isWorldCup: options?.isWorldCup || false,
      providerPath: options?.providerPath || sport.espnPath || null,
      competitionId: options?.competition?.id || null,
      country: options?.competition?.country || null,
      eventKind: "match",
      home: scoreFromCompetitor(home),
      away: scoreFromCompetitor(away),
    }];
  });
}

function parseRaceScoreboard(json: unknown, sport: Pick<SportDefinition, "id" | "name" | "espnPath">): ScoreItem[] {
  const events = asArray<Record<string, unknown>>(asRecord(json).events);
  return events.map((event) => {
    const statusType = asRecord(asRecord(event.status).type);
    const rawState = asText(statusType.state);
    const state: ScoreItem["state"] = rawState === "pre" || rawState === "in" || rawState === "post" ? rawState : "unknown";
    const competition = asArray<Record<string, unknown>>(event.competitions)[0];
    const venue = asRecord(competition?.venue);
    const season = asRecord(event.season);
    const raceName = repairMojibake(asText(event.shortName, asText(event.name, "Grande Prêmio")));
    return {
      id: asText(event.id),
      sportId: sport.id,
      league: "Fórmula 1",
      round: repairMojibake(asText(asRecord(season.type).name)) || null,
      venue: repairMojibake(asText(venue.fullName)) || null,
      broadcast: null,
      status: repairMojibake(asText(statusType.shortDetail, asText(statusType.detail, "Agenda confirmada"))),
      state,
      startTime: typeof event.date === "string" ? event.date : null,
      providerPath: sport.espnPath || null,
      eventKind: "race",
      home: { name: raceName, score: null },
      away: { name: "Fórmula 1", score: null },
    };
  });
}

function formatDateRange(daysBack: number, daysAhead: number) {
  const start = new Date();
  const end = new Date();
  start.setUTCDate(start.getUTCDate() - daysBack);
  end.setUTCDate(end.getUTCDate() + daysAhead);
  const compact = (date: Date) => date.toISOString().slice(0, 10).replace(/-/g, "");
  return `${compact(start)}-${compact(end)}`;
}

function sortEvents(items: ScoreItem[]) {
  return [...items].sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return aTime - bTime;
  });
}

function uniqueScores(items: ScoreItem[]) {
  return Array.from(new Map(items.filter((item) => item.id).map((item) => [`${item.sportId}:${item.id}`, item])).values());
}

function normalizedText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function scoreMatchesCompetition(score: ScoreItem, competition: FootballCompetition) {
  if (score.competitionId === competition.id) return true;
  const haystack = normalizedText(`${score.league} ${score.round || ""} ${score.country || ""}`);
  return [competition.name, competition.country, competition.espnPath.split("/").pop() || ""]
    .map(normalizedText)
    .some((term) => term.length > 3 && haystack.includes(term));
}

function numericScore(value: string | null) {
  if (value === null) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function ensureTableRow(rows: Map<string, CompetitionTableRow>, team: ScoreItem["home"]) {
  const key = team.name;
  if (!rows.has(key)) {
    rows.set(key, {
      team: team.name,
      logo: team.logo || null,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      points: 0,
      form: [],
    });
  }
  return rows.get(key)!;
}

function buildCompetitionTable(events: ScoreItem[]) {
  const rows = new Map<string, CompetitionTableRow>();
  for (const score of events) {
    ensureTableRow(rows, score.home);
    ensureTableRow(rows, score.away);
    if (score.state !== "post") continue;
    const homeScore = numericScore(score.home.score);
    const awayScore = numericScore(score.away.score);
    if (homeScore === null || awayScore === null) continue;
    const home = ensureTableRow(rows, score.home);
    const away = ensureTableRow(rows, score.away);
    home.played += 1;
    away.played += 1;
    home.goalsFor += homeScore;
    home.goalsAgainst += awayScore;
    away.goalsFor += awayScore;
    away.goalsAgainst += homeScore;
    if (homeScore === awayScore) {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
      home.form.unshift("E");
      away.form.unshift("E");
    } else if (homeScore > awayScore) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
      home.form.unshift("V");
      away.form.unshift("D");
    } else {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
      away.form.unshift("V");
      home.form.unshift("D");
    }
    home.form = home.form.slice(0, 5);
    away.form = away.form.slice(0, 5);
  }

  return [...rows.values()]
    .sort((a, b) => b.points - a.points || (b.goalsFor - b.goalsAgainst) - (a.goalsFor - a.goalsAgainst) || b.goalsFor - a.goalsFor || a.team.localeCompare(b.team))
    .slice(0, 20);
}

function buildCompetitionLeaders(events: ScoreItem[]): CompetitionLeader[] {
  const table = buildCompetitionTable(events).filter((row) => row.played > 0);
  const byGoals = [...table].sort((a, b) => b.goalsFor - a.goalsFor);
  const byDefense = [...table].sort((a, b) => a.goalsAgainst - b.goalsAgainst);
  const byForm = [...table].sort((a, b) => b.points - a.points);
  return [
    byGoals[0] ? { label: "Ataque no recorte", team: byGoals[0].team, value: `${byGoals[0].goalsFor} gols` } : null,
    byDefense[0] ? { label: "Defesa no recorte", team: byDefense[0].team, value: `${byDefense[0].goalsAgainst} sofridos` } : null,
    byForm[0] ? { label: "Melhor campanha", team: byForm[0].team, value: `${byForm[0].points} pts` } : null,
  ].filter((item): item is CompetitionLeader => item !== null);
}

async function fetchScoreboard(path: string, sport: SportDefinition, options?: { competition?: FootballCompetition }) {
  const params = new URLSearchParams({ limit: "100", dates: formatDateRange(3, sport.id === "formula1" ? 75 : 14) });
  const response = await fetchWithTimeout(`${ESPN_BASE}/${path}/scoreboard?${params.toString()}`, {
    cache: "no-store", headers: { "user-agent": "LAP Sports Dashboard/5.0" },
  });
  if (!response.ok) throw new Error(`Scoreboard ${response.status}`);
  const json = await response.json();
  return sport.id === "formula1"
    ? parseRaceScoreboard(json, sport)
    : parseScoreboard(json, sport, { providerPath: path, competition: options?.competition });
}

async function loadFootballScores(): Promise<ScoreItem[]> {
  const football = findSportById("futebol");
  // O endpoint amplo entrega a visão mundial quando a fonte a disponibiliza. Em seguida,
  // a LAP complementa com competições prioritárias para não deixar o Brasileirão invisível.
  try {
    const global = await fetchScoreboard("soccer", football);
    if (global.length) return sortEvents(uniqueScores(global));
  } catch {
    // A estratégia por competição abaixo é o fallback resiliente.
  }

  const selected = FOOTBALL_COMPETITIONS.filter((competition) => competition.tier !== "regional").slice(0, FOOTBALL_FETCH_LIMIT);
  const results = await Promise.allSettled(selected.map(async (competition) => fetchScoreboard(competition.espnPath, football, { competition })));
  const events = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  if (!events.length) throw new Error("Cobertura de futebol indisponível");
  return sortEvents(uniqueScores(events));
}

async function loadScores(sport: SportDefinition): Promise<ScoreItem[]> {
  if (!sport.espnPath) return [];
  if (sport.id === "futebol") return loadFootballScores();
  return sortEvents(await fetchScoreboard(sport.espnPath, sport));
}

async function loadWorldCup(): Promise<WorldCupFeed> {
  const tournament = { id: "futebol" as SportId, name: "Copa do Mundo FIFA 2026", espnPath: WORLD_CUP_PATH };
  const params = new URLSearchParams({ limit: "500", dates: WORLD_CUP_WINDOW });
  const response = await fetchWithTimeout(`${ESPN_BASE}/${WORLD_CUP_PATH}/scoreboard?${params.toString()}`, {
    cache: "no-store", headers: { "user-agent": "LAP Sports Dashboard/4.0" },
  });
  if (!response.ok) throw new Error(`World Cup ${response.status}`);
  return { name: tournament.name, events: sortEvents(parseScoreboard(await response.json(), tournament, { isWorldCup: true, providerPath: WORLD_CUP_PATH })), sourceStatus: "ok" };
}

function clonePayload(payload: LivePayload): LivePayload {
  return {
    ...payload,
    football: { ...payload.football, competitions: [...payload.football.competitions], activeCompetitionIds: [...payload.football.activeCompetitionIds] },
    feeds: payload.feeds.map((feed) => ({ ...feed, news: [...feed.news], scores: feed.scores.map((score) => ({ ...score, home: { ...score.home }, away: { ...score.away } })) })),
    editorial: [...payload.editorial],
    worldCup: { ...payload.worldCup, events: payload.worldCup.events.map((score) => ({ ...score, home: { ...score.home }, away: { ...score.away } })) },
  };
}

export function subscribeToLiveEvents(listener: (event: { type: "score"; patch: LiveWebhookPatch } | { type: "snapshot"; payload: LivePayload }) => void) {
  liveSubscribers.add(listener);
  return () => liveSubscribers.delete(listener);
}

function publishLiveEvent(event: { type: "score"; patch: LiveWebhookPatch } | { type: "snapshot"; payload: LivePayload }) {
  for (const listener of liveSubscribers) {
    try { listener(event); } catch { /* Listener individual não deve quebrar o stream. */ }
  }
}

function patchScore(score: ScoreItem, patch: LiveWebhookPatch): ScoreItem {
  if (score.id !== patch.eventId || (patch.sportId && score.sportId !== patch.sportId)) return score;
  return {
    ...score,
    state: patch.state || score.state,
    status: patch.status ? repairMojibake(patch.status) : score.status,
    home: { ...score.home, score: patch.homeScore !== undefined ? (patch.homeScore === null ? null : String(patch.homeScore)) : score.home.score },
    away: { ...score.away, score: patch.awayScore !== undefined ? (patch.awayScore === null ? null : String(patch.awayScore)) : score.away.score },
  };
}

export function ingestLiveWebhook(patch: LiveWebhookPatch) {
  if (!patch.eventId || typeof patch.eventId !== "string") throw new Error("O webhook precisa informar eventId.");
  if (patch.sportId && !SPORTS.some((sport) => sport.id === patch.sportId)) throw new Error("sportId inválido no webhook.");

  if (liveCache) {
    const payload = clonePayload(liveCache.payload);
    payload.feeds = payload.feeds.map((feed) => ({ ...feed, scores: feed.scores.map((score) => patchScore(score, patch)) }));
    payload.worldCup = { ...payload.worldCup, events: payload.worldCup.events.map((score) => patchScore(score, patch)) };
    payload.generatedAt = patch.occurredAt || new Date().toISOString();
    liveCache = { payload, expiresAt: Math.max(liveCache.expiresAt, Date.now() + CACHE_TTL_MS) };
  }

  publishLiveEvent({ type: "score", patch });
  return { acceptedAt: new Date().toISOString() };
}

function getPreviousFeed(sportId: SportId) {
  if (!lastHealthyPayload || Date.now() - lastHealthyPayload.cachedAt > STALE_WINDOW_MS) return null;
  return lastHealthyPayload.payload.feeds.find((feed) => feed.id === sportId) ?? null;
}

export async function getLivePayload(): Promise<LivePayload> {
  if (liveCache && liveCache.expiresAt > Date.now()) return liveCache.payload;

  const [feedResults, worldCupResult, editorialResult] = await Promise.all([
    Promise.all(SPORTS.map(async (sport) => {
      const [newsResult, scoreResult] = await Promise.allSettled([loadNews(sport), loadScores(sport)]);
      const previous = getPreviousFeed(sport.id);
      const hasFreshNews = newsResult.status === "fulfilled";
      const hasFreshScores = Boolean(sport.espnPath) && scoreResult.status === "fulfilled";
      const hasFreshSource = hasFreshNews || hasFreshScores;
      const scores = hasFreshScores && scoreResult.status === "fulfilled" ? scoreResult.value : previous?.scores ?? [];
      const news = hasFreshNews && newsResult.status === "fulfilled" ? newsResult.value : previous?.news ?? [];
      return {
        ...sport,
        news,
        scores,
        sourceStatus: hasFreshSource ? "live" : previous ? "stale" : "unavailable",
        sourceNote: hasFreshSource ? null : previous ? "Última resposta válida preservada enquanto a fonte reconecta." : "Fonte temporariamente indisponível; a cobertura editorial continua disponível.",
      } satisfies SportFeed;
    })),
    loadWorldCup().then((feed) => ({ feed, fresh: true })).catch(() => {
      const stale = lastHealthyPayload && Date.now() - lastHealthyPayload.cachedAt <= STALE_WINDOW_MS ? lastHealthyPayload.payload.worldCup : null;
      return { feed: stale ? { ...stale, sourceStatus: "unavailable" as const } : { name: "Copa do Mundo FIFA 2026", events: [], sourceStatus: "unavailable" as const }, fresh: false };
    }),
    getPublishedEditorialArticles(12).catch(() => []),
  ]);

  const footballFeed = feedResults.find((feed) => feed.id === "futebol");
  const editorial = editorialResult.map(editorialToNews).filter((item): item is NewsItem => item !== null);
  const guideItems = fallbackEditorialItems();
  const payload: LivePayload = {
    generatedAt: new Date().toISOString(),
    refreshSeconds: 30,
    editorial: editorial.length ? editorial : guideItems,
    feeds: feedResults,
    football: {
      competitions: FOOTBALL_COMPETITIONS,
      activeCompetitionIds: [...new Set((footballFeed?.scores ?? []).map((score) => score.competitionId).filter((id): id is string => Boolean(id)))],
      sourceStatus: footballFeed?.sourceStatus ?? "unavailable",
      sourceNote: footballFeed?.sourceNote ?? "Cobertura em reconexão.",
    },
    worldCup: worldCupResult.feed,
  };

  if (feedResults.some((feed) => feed.sourceStatus === "live") || worldCupResult.fresh) {
    lastHealthyPayload = { cachedAt: Date.now(), payload: clonePayload(payload) };
  }
  liveCache = { payload, expiresAt: Date.now() + CACHE_TTL_MS };
  return payload;
}

function parseTimeline(json: unknown): GameTimelineItem[] {
  const plays = asArray<Record<string, unknown>>(asRecord(json).plays);
  return plays.slice(-80).map((play, index) => {
    const clock = asRecord(play.clock);
    const period = asRecord(play.period);
    const team = asRecord(play.team);
    return {
      id: asText(play.id, `play-${index}`),
      period: asText(period.displayValue, asText(period.number)) || null,
      clock: asText(clock.displayValue) || null,
      text: repairMojibake(asText(play.text, asText(play.shortText, "Atualização da partida"))),
      scoring: Boolean(play.scoringPlay),
      homeScore: asText(play.homeScore) || null,
      awayScore: asText(play.awayScore) || null,
      team: repairMojibake(asText(team.displayName, asText(team.abbreviation))) || null,
    };
  }).reverse();
}

function parseTeamStats(json: unknown): GameTeamStat[] {
  const teams = asArray<Record<string, unknown>>(asRecord(asRecord(json).boxscore).teams);
  return teams.map((entry) => {
    const team = asRecord(entry.team);
    const stats = asArray<Record<string, unknown>>(entry.statistics).slice(0, 12).flatMap((stat) => {
      const label = repairMojibake(asText(stat.label, asText(stat.name)));
      const value = repairMojibake(asText(stat.displayValue, asText(stat.value)));
      return label && value ? [{ label, value }] : [];
    });
    return { team: repairMojibake(asText(team.displayName, asText(team.abbreviation, "Equipe"))), logo: asText(team.logo) || null, stats };
  }).filter((team) => team.stats.length > 0);
}

function parseLineups(json: unknown): GameLineup[] {
  const players = asArray<Record<string, unknown>>(asRecord(asRecord(json).boxscore).players);
  return players.map((group) => {
    const team = asRecord(group.team);
    const categories = asArray<Record<string, unknown>>(group.statistics);
    const athleteNames = categories.flatMap((category) => asArray<Record<string, unknown>>(category.athletes))
      .map((athlete) => repairMojibake(asText(asRecord(athlete.athlete).displayName, asText(athlete.displayName))))
      .filter(Boolean)
      .slice(0, 18);
    return { team: repairMojibake(asText(team.displayName, asText(team.abbreviation, "Equipe"))), players: [...new Set(athleteNames)] };
  }).filter((group) => group.players.length > 0);
}

function parseNotes(json: unknown) {
  const gameInfo = asRecord(json).gameInfo;
  const notes = asArray<Record<string, unknown>>(asRecord(gameInfo).notes)
    .map((note) => repairMojibake(asText(note.headline, asText(note.text))))
    .filter(Boolean);
  const venue = repairMojibake(asText(asRecord(asRecord(gameInfo).venue).fullName));
  return venue ? [venue, ...notes] : notes;
}

function parseHeadlines(json: unknown) {
  return asArray<Record<string, unknown>>(asRecord(json).news)
    .map((item) => repairMojibake(asText(item.headline, asText(item.description))))
    .filter(Boolean)
    .slice(0, 6);
}

export async function getGameDetails(sportId: SportId, eventId: string, options?: { worldCup?: boolean }): Promise<GameDetails | null> {
  const sport = findSportById(sportId);
  const path = options?.worldCup ? WORLD_CUP_PATH : sport.espnPath;
  if (!path || !eventId) return null;

  try {
    const response = await fetchWithTimeout(`${ESPN_BASE}/${path}/summary?event=${encodeURIComponent(eventId)}`, {
      cache: "no-store", headers: { "user-agent": "LAP Sports Dashboard/4.0" },
    });
    if (!response.ok) return null;
    const json = await response.json();
    const header = asRecord(asRecord(json).header);
    const event = (sportId === "formula1"
      ? parseRaceScoreboard({ events: [header] }, sport)
      : parseScoreboard({ events: [header] }, sport, { providerPath: path, isWorldCup: Boolean(options?.worldCup) })
    )[0];
    if (!event) return null;
    return {
      event,
      timeline: parseTimeline(json),
      teamStats: parseTeamStats(json),
      lineups: parseLineups(json),
      headlines: parseHeadlines(json),
      notes: parseNotes(json),
      sourceStatus: "ok",
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getCompetitionDetails(competitionId: string): Promise<CompetitionDetails | null> {
  const competition = FOOTBALL_COMPETITIONS.find((item) => item.id === competitionId);
  if (!competition) return null;

  const payload = await getLivePayload();
  const footballFeed = payload.feeds.find((feed) => feed.id === "futebol");
  const allFootballScores = footballFeed?.scores ?? [];
  const scores = sortEvents(allFootballScores.filter((score) => scoreMatchesCompetition(score, competition)));
  const live = scores.filter((score) => score.state === "in");
  const upcoming = scores.filter((score) => score.state === "pre").sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : Number.MAX_SAFE_INTEGER;
    return aTime - bTime;
  });
  const recent = scores.filter((score) => score.state === "post").sort((a, b) => {
    const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
    const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
    return bTime - aTime;
  });
  const normalizedName = normalizedText(`${competition.name} ${competition.country}`);
  const news = [...payload.editorial, ...(footballFeed?.news ?? [])]
    .filter((item) => {
      const text = normalizedText(`${item.title} ${item.excerpt} ${item.source}`);
      return normalizedName.split(" ").some((term) => term.length > 4 && text.includes(term));
    })
    .slice(0, 6);

  return {
    competition,
    live,
    upcoming,
    recent,
    table: buildCompetitionTable(scores),
    leaders: buildCompetitionLeaders(scores),
    news,
    sourceStatus: footballFeed?.sourceStatus ?? "unavailable",
    sourceNote: footballFeed?.sourceNote ?? null,
    generatedAt: payload.generatedAt,
  };
}

export async function findArticleBySlug(slug: string) {
  const payload = await getLivePayload();
  return payload.feeds.flatMap((feed) => feed.news).find((item) => item.slug === slug) ?? null;
}

export function findSportById(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId) ?? SPORTS[0];
}

export function getLiveHealth(payload: LivePayload) {
  const scoreSources = payload.feeds.filter((feed) => feed.espnPath).length;
  const feedsWithNews = payload.feeds.filter((feed) => feed.news.length > 0).length;
  const feedsWithScores = payload.feeds.filter((feed) => feed.scores.length > 0).length;
  const liveFeeds = payload.feeds.filter((feed) => feed.sourceStatus === "live").length;
  const staleFeeds = payload.feeds.filter((feed) => feed.sourceStatus === "stale").length;
  return {
    generatedAt: payload.generatedAt,
    refreshSeconds: payload.refreshSeconds,
    worldCup: payload.worldCup.sourceStatus,
    feeds: payload.feeds.length,
    feedsWithNews,
    feedsWithScores,
    scoreSources,
    liveFeeds,
    staleFeeds,
    footballCompetitions: payload.football.competitions.length,
    status: liveFeeds > 0 || payload.worldCup.sourceStatus === "ok" ? "operational" : staleFeeds > 0 || feedsWithNews > 0 ? "degraded" : "unavailable",
  } as const;
}
