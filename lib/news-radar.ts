import type { SportId } from "@/lib/live-data";

export type RadarSportId = SportId | "college-football";
export type RadarDecision = "candidate" | "monitor" | "review";

export type RadarStory = {
  id: string;
  title: string;
  description: string;
  url: string;
  sourceName: string;
  sourceUrl: string | null;
  provider: string;
  publishedAt: string;
  sportId: RadarSportId;
  sportLabel: string;
  score: number;
  decision: RadarDecision;
  isRumor: boolean;
  corroborationSources: string[];
};

export type RadarProviderState = {
  id: string;
  label: string;
  enabled: boolean;
  ok: boolean;
  itemCount: number;
  note: string;
};

export type NewsRadarResult = {
  stories: RadarStory[];
  providers: RadarProviderState[];
  generatedAt: string;
  query: string;
  sport: string;
};

type RadarSportConfig = { id: RadarSportId; label: string; query: string; keywords: string[] };
type RawRadarStory = {
  id: string;
  title: string;
  description: string;
  url: string;
  sourceName: string;
  sourceUrl: string | null;
  provider: string;
  publishedAt: string;
  sportHint?: RadarSportId;
};

type SearchTarget = { id?: RadarSportId; label: string; query: string };

export const RADAR_SPORTS: RadarSportConfig[] = [
  { id: "futebol", label: "Futebol", query: "futebol OR Brasileirão OR Libertadores OR Corinthians OR Flamengo OR Palmeiras OR \"Champions League\" OR \"Premier League\"", keywords: ["futebol", "brasileirão", "libertadores", "sul-americana", "corinthians", "flamengo", "palmeiras", "são paulo", "santos", "botafogo", "fluminense", "vasco", "grêmio", "internacional", "cruzeiro", "bahia", "arsenal", "chelsea", "liverpool", "barcelona", "real madrid", "manchester", "champions league", "premier league", "la liga"] },
  { id: "futebol-americano", label: "NFL", query: "NFL OR \"National Football League\"", keywords: ["nfl", "super bowl", "training camp", "quarterback", "touchdown", "patriots", "seahawks", "chiefs", "cowboys", "eagles", "49ers", "raiders"] },
  { id: "college-football", label: "College Football", query: "\"college football\" OR \"NCAA football\" OR CFP", keywords: ["college football", "ncaa football", "cfp", "college football playoff", "sec", "big ten", "acc", "big 12", "fbs", "fcs"] },
  { id: "formula1", label: "Fórmula 1", query: "\"Formula 1\" OR Fórmula 1 OR F1", keywords: ["formula 1", "fórmula 1", "grand prix", "gp da", "verstappen", "hamilton", "leclerc", "antonelli", "ferrari", "mercedes", "mclaren", "red bull", "aston martin"] },
  { id: "basquete", label: "NBA", query: "NBA OR basquete", keywords: ["nba", "basquete", "basketball", "lakers", "celtics", "warriors", "knicks", "heat", "bucks", "timberwolves", "76ers"] },
  { id: "tenis", label: "Tênis", query: "ATP OR WTA OR tênis OR tennis", keywords: ["atp", "wta", "tênis", "tennis", "sinner", "alcaraz", "djokovic", "sabalenka", "swiatek", "wimbledon", "us open", "roland garros", "australian open"] },
  { id: "ciclismo", label: "Ciclismo / Tour", query: "\"Tour de France\" OR ciclismo OR cycling", keywords: ["tour de france", "ciclismo", "cycling", "pogacar", "evenepoel", "vingegaard", "giro d'italia", "vuelta"] },
  { id: "beisebol", label: "MLB", query: "MLB OR beisebol OR baseball", keywords: ["mlb", "beisebol", "baseball", "yankees", "dodgers", "mets", "red sox", "trade deadline", "world series"] },
  { id: "golfe", label: "Golfe", query: "PGA OR golfe OR golf", keywords: ["pga", "golfe", "golf", "fedexcup", "masters", "ryder cup", "scheffler", "mcilroy", "lpga", "3m open"] },
  { id: "surfe", label: "Surfe / WSL", query: "WSL OR surfe OR surf", keywords: ["wsl", "surfe", "surf", "championship tour", "teahupo", "medina", "italo ferreira", "yago dora", "gabriela bryan"] },
];

const BROAD_QUERY = "Brasileirão OR Libertadores OR NFL OR NBA OR \"Formula 1\" OR ATP OR WTA OR \"Tour de France\" OR MLB OR PGA OR WSL";
const RUMOR_WORDS = ["pode", "mira", "interesse", "interessado", "sonda", "sondagem", "rumor", "estuda", "avalia", "negocia", "negociação", "alvo", "cogita"];
const CONFIRMATION_WORDS = ["anuncia", "anunciou", "confirma", "confirmou", "oficial", "vence", "venceu", "lidera", "resultado", "contrata", "contratou", "assina", "assinou"];
const RADAR_WINDOW_MS = 72 * 60 * 60 * 1000;

function cleanText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function tagValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? cleanText(match[1]) : "";
}

function sourceValue(block: string) {
  const match = block.match(/<source(?:\s+url="([^"]+)")?[^>]*>([\s\S]*?)<\/source>/i);
  return match ? { url: match[1] || null, name: cleanText(match[2]) } : { url: null, name: "Fonte não identificada" };
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `radar-${(hash >>> 0).toString(16)}`;
}

function safeOrigin(value: string) {
  try { return new URL(value).origin; } catch { return null; }
}

async function radarFetch(url: string, forceRefresh: boolean, extraHeaders?: Record<string, string>) {
  const headers = { "user-agent": "LAP News Radar/1.1", ...(extraHeaders || {}) };
  if (forceRefresh) return fetch(url, { cache: "no-store", headers });
  return fetch(url, { next: { revalidate: 300 }, headers });
}

async function fetchGoogleNews(query: string, sportHint: RadarSportId | undefined, forceRefresh: boolean): Promise<RawRadarStory[]> {
  const params = new URLSearchParams({ q: query, hl: "pt-BR", gl: "BR", ceid: "BR:pt-419" });
  const response = await radarFetch(`https://news.google.com/rss/search?${params.toString()}`, forceRefresh);
  if (!response.ok) throw new Error(`Google News RSS ${response.status}`);
  const xml = await response.text();
  return Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)).slice(0, 35).map((match) => {
    const block = match[1];
    const source = sourceValue(block);
    const rawTitle = tagValue(block, "title");
    const title = source.name && rawTitle.endsWith(` - ${source.name}`) ? rawTitle.slice(0, -(source.name.length + 3)).trim() : rawTitle;
    const link = tagValue(block, "link");
    const date = new Date(tagValue(block, "pubDate"));
    return {
      id: stableId(tagValue(block, "guid") || link || title),
      title,
      description: tagValue(block, "description"),
      url: link,
      sourceName: source.name,
      sourceUrl: source.url,
      provider: "Google News RSS",
      publishedAt: Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString(),
      sportHint,
    };
  }).filter((item) => item.title && item.url);
}

async function fetchNewsApi(query: string, sportHint: RadarSportId | undefined, forceRefresh: boolean): Promise<RawRadarStory[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ q: query, from: new Date(Date.now() - RADAR_WINDOW_MS).toISOString(), language: "pt", sortBy: "publishedAt", pageSize: "50" });
  const response = await radarFetch(`https://newsapi.org/v2/everything?${params.toString()}`, forceRefresh, { "X-Api-Key": apiKey });
  if (!response.ok) throw new Error(`NewsAPI ${response.status}`);
  const payload = await response.json() as { articles?: Array<{ title?: string; description?: string; url?: string; publishedAt?: string; source?: { name?: string } }> };
  return (payload.articles || []).map((article) => ({
    id: stableId(article.url || article.title || "newsapi"),
    title: cleanText(article.title || ""),
    description: cleanText(article.description || ""),
    url: article.url || "",
    sourceName: cleanText(article.source?.name || "NewsAPI"),
    sourceUrl: article.url ? safeOrigin(article.url) : null,
    provider: "NewsAPI",
    publishedAt: article.publishedAt || new Date().toISOString(),
    sportHint,
  })).filter((item) => item.title && item.url);
}

async function fetchGNews(query: string, sportHint: RadarSportId | undefined, forceRefresh: boolean): Promise<RawRadarStory[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ q: query, lang: "pt", country: "br", max: "50", from: new Date(Date.now() - RADAR_WINDOW_MS).toISOString(), apikey: apiKey });
  const response = await radarFetch(`https://gnews.io/api/v4/search?${params.toString()}`, forceRefresh);
  if (!response.ok) throw new Error(`GNews ${response.status}`);
  const payload = await response.json() as { articles?: Array<{ title?: string; description?: string; url?: string; publishedAt?: string; source?: { name?: string; url?: string } }> };
  return (payload.articles || []).map((article) => ({
    id: stableId(article.url || article.title || "gnews"),
    title: cleanText(article.title || ""),
    description: cleanText(article.description || ""),
    url: article.url || "",
    sourceName: cleanText(article.source?.name || "GNews"),
    sourceUrl: article.source?.url || null,
    provider: "GNews",
    publishedAt: article.publishedAt || new Date().toISOString(),
    sportHint,
  })).filter((item) => item.title && item.url);
}

async function fetchGuardian(query: string, sportHint: RadarSportId | undefined, forceRefresh: boolean): Promise<RawRadarStory[]> {
  const apiKey = process.env.GUARDIAN_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ section: "sport", q: query, "from-date": new Date(Date.now() - RADAR_WINDOW_MS).toISOString().slice(0, 10), "order-by": "newest", "page-size": "50", "show-fields": "trailText", "api-key": apiKey });
  const response = await radarFetch(`https://content.guardianapis.com/search?${params.toString()}`, forceRefresh);
  if (!response.ok) throw new Error(`Guardian ${response.status}`);
  const payload = await response.json() as { response?: { results?: Array<{ id?: string; webTitle?: string; webUrl?: string; webPublicationDate?: string; fields?: { trailText?: string } }> } };
  return (payload.response?.results || []).map((article) => ({
    id: stableId(article.id || article.webUrl || article.webTitle || "guardian"),
    title: cleanText(article.webTitle || ""),
    description: cleanText(article.fields?.trailText || ""),
    url: article.webUrl || "",
    sourceName: "The Guardian",
    sourceUrl: "https://www.theguardian.com/sport",
    provider: "Guardian Open Platform",
    publishedAt: article.webPublicationDate || new Date().toISOString(),
    sportHint,
  })).filter((item) => item.title && item.url);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function classifySport(item: RawRadarStory): RadarSportConfig | null {
  if (item.sportHint) return RADAR_SPORTS.find((sport) => sport.id === item.sportHint) || null;
  const text = normalize(`${item.title} ${item.description}`);
  let best: { sport: RadarSportConfig; hits: number } | null = null;
  for (const sport of RADAR_SPORTS) {
    const hits = sport.keywords.reduce((count, keyword) => count + (text.includes(normalize(keyword)) ? 1 : 0), 0);
    if (hits && (!best || hits > best.hits)) best = { sport, hits };
  }
  return best?.sport || null;
}

function sourceTrust(item: RawRadarStory) {
  const text = normalize(`${item.sourceName} ${item.sourceUrl || ""}`);
  if (/reuters|ap news|associated press/.test(text)) return 27;
  if (/ge\.globo|globo esporte|globoesporte|\bge\b/.test(text)) return 25;
  if (/nfl\.com|nba\.com|mlb\.com|formula1\.com|atptour\.com|wtatennis\.com|letour\.fr|pgatour\.com|worldsurfleague\.com/.test(text)) return 28;
  if (/espn|the guardian|bbc|cbf|conmebol|uefa|fifa/.test(text)) return 23;
  if (/uol|lance|terra|cnn brasil|band/.test(text)) return 18;
  return 12;
}

function recencyScore(publishedAt: string) {
  const timestamp = new Date(publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  const ageHours = Math.max(0, (Date.now() - timestamp) / 3_600_000);
  if (ageHours <= 2) return 25;
  if (ageHours <= 6) return 22;
  if (ageHours <= 12) return 18;
  if (ageHours <= 24) return 14;
  if (ageHours <= 48) return 8;
  if (ageHours <= 72) return 4;
  return 0;
}

function textContainsAny(text: string, words: string[]) {
  const normalized = normalize(text);
  return words.some((word) => normalized.includes(normalize(word)));
}

function queryMatchScore(item: RawRadarStory, query: string) {
  if (!query.trim()) return 0;
  const text = normalize(`${item.title} ${item.description}`);
  const tokens = normalize(query).split(/\s+/).filter((token) => token.length >= 3 && !["and", "or", "not"].includes(token));
  if (!tokens.length) return 0;
  return Math.min(12, Math.round((tokens.filter((token) => text.includes(token)).length / tokens.length) * 12));
}

function buildStory(item: RawRadarStory, query: string): RadarStory | null {
  const sport = classifySport(item);
  if (!sport) return null;
  const text = `${item.title} ${item.description}`;
  const isRumor = textContainsAny(text, RUMOR_WORDS) && !textContainsAny(text, CONFIRMATION_WORDS);
  const confirmationBoost = textContainsAny(text, CONFIRMATION_WORDS) ? 6 : 0;
  const score = Math.max(0, Math.min(100, 24 + sourceTrust(item) + recencyScore(item.publishedAt) + queryMatchScore(item, query) + confirmationBoost - (isRumor ? 10 : 0)));
  const decision: RadarDecision = score >= 80 && !isRumor ? "candidate" : score >= 62 ? "monitor" : "review";
  return { ...item, sportId: sport.id, sportLabel: sport.label, score, decision, isRumor, corroborationSources: [item.sourceName] };
}

function titleTokens(title: string) {
  return new Set(normalize(title).replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((token) => token.length > 3 && !["para", "com", "sobre", "apos", "pela", "pelo", "mais", "como"].includes(token)));
}

function similarity(a: string, b: string) {
  const aa = titleTokens(a);
  const bb = titleTokens(b);
  if (!aa.size || !bb.size) return 0;
  let intersection = 0;
  aa.forEach((token) => { if (bb.has(token)) intersection += 1; });
  return intersection / Math.max(aa.size, bb.size);
}

function dedupe(stories: RadarStory[]) {
  const output: RadarStory[] = [];
  for (const story of [...stories].sort((a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())) {
    const duplicate = output.find((current) => current.sportId === story.sportId && similarity(current.title, story.title) >= 0.72);
    if (!duplicate) { output.push(story); continue; }
    if (!duplicate.corroborationSources.includes(story.sourceName)) duplicate.corroborationSources.push(story.sourceName);
    duplicate.score = Math.min(100, duplicate.score + 3);
    if (duplicate.score >= 80 && !duplicate.isRumor) duplicate.decision = "candidate";
  }
  return output;
}

function selectedSports(sport: string, query: string): SearchTarget[] {
  const selected = RADAR_SPORTS.find((item) => item.id === sport);
  if (query.trim()) return selected ? [{ id: selected.id, label: selected.label, query: `${query} ${selected.query}` }] : [{ label: "Pesquisa", query }];
  return selected ? [{ id: selected.id, label: selected.label, query: selected.query }] : RADAR_SPORTS.map((item) => ({ id: item.id, label: item.label, query: item.query }));
}

function recentOnly(story: RadarStory) {
  const timestamp = new Date(story.publishedAt).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp <= RADAR_WINDOW_MS;
}

export async function getNewsRadar(options?: { sport?: string; query?: string; forceRefresh?: boolean; limit?: number }): Promise<NewsRadarResult> {
  const sport = options?.sport || "all";
  const query = options?.query?.trim() || "";
  const forceRefresh = options?.forceRefresh === true;
  const targets = selectedSports(sport, query);
  const providers: RadarProviderState[] = [];
  const raw: RawRadarStory[] = [];

  const googleResults = await Promise.allSettled(targets.map((target) => fetchGoogleNews(target.query, target.id, forceRefresh)));
  let googleCount = 0;
  let googleOk = false;
  googleResults.forEach((result) => {
    if (result.status === "fulfilled") { raw.push(...result.value); googleCount += result.value.length; googleOk = true; }
  });
  providers.push({ id: "google-news", label: "Google News RSS", enabled: true, ok: googleOk, itemCount: googleCount, note: "Descoberta ampla de fontes esportivas, incluindo ge, veículos brasileiros e fontes internacionais." });

  const providerQuery = query || (targets.length === 1 ? targets[0].query : BROAD_QUERY);
  const providerHint = targets.length === 1 ? targets[0].id : undefined;
  const optional = [
    { id: "newsapi", label: "NewsAPI", enabled: Boolean(process.env.NEWSAPI_KEY), run: () => fetchNewsApi(providerQuery, providerHint, forceRefresh), note: "Ative com NEWSAPI_KEY para ampliar descoberta por domínio, idioma e data." },
    { id: "gnews", label: "GNews", enabled: Boolean(process.env.GNEWS_API_KEY), run: () => fetchGNews(providerQuery, providerHint, forceRefresh), note: "Ative com GNEWS_API_KEY para ampliar cobertura em português e Brasil." },
    { id: "guardian", label: "The Guardian", enabled: Boolean(process.env.GUARDIAN_API_KEY), run: () => fetchGuardian(providerQuery, providerHint, forceRefresh), note: "Ative com GUARDIAN_API_KEY para busca oficial na seção Sport." },
  ];

  for (const provider of optional) {
    if (!provider.enabled) {
      providers.push({ id: provider.id, label: provider.label, enabled: false, ok: false, itemCount: 0, note: provider.note });
      continue;
    }
    try {
      const items = await provider.run();
      raw.push(...items);
      providers.push({ id: provider.id, label: provider.label, enabled: true, ok: true, itemCount: items.length, note: provider.note });
    } catch {
      providers.push({ id: provider.id, label: provider.label, enabled: true, ok: false, itemCount: 0, note: `${provider.note} A fonte falhou nesta rodada; nenhuma informação foi inventada.` });
    }
  }

  const stories = dedupe(raw.map((item) => buildStory(item, query)).filter((item): item is RadarStory => item !== null).filter(recentOnly))
    .filter((story) => sport === "all" || story.sportId === sport)
    .sort((a, b) => b.score - a.score || new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, Math.max(1, Math.min(options?.limit || 120, 200)));

  return { stories, providers, generatedAt: new Date().toISOString(), query, sport };
}
