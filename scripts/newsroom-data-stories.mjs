import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_PATH = path.join(process.cwd(), "content", "newsroom", "articles.json");
const SITE_URL = process.env.LAP_SITE_URL || "https://lap-live-sports.vercel.app";
const LOOKBACK_MS = 36 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const MAX_NEW_ARTICLES = 4;
const MAX_STORED_ARTICLES = 300;

const LABELS = {
  futebol: "Futebol",
  "futebol-americano": "NFL",
  tenis: "Tênis",
  ciclismo: "Ciclismo",
  formula1: "Fórmula 1",
  basquete: "NBA",
  beisebol: "MLB",
  golfe: "Golfe",
  surfe: "Surfe",
};

const COVER_IMAGES = {
  futebol: "/images/sports/futebol.jpg",
  "futebol-americano": "/images/sports/futebol-americano.jpg",
  tenis: "/images/sports/tenis.jpg",
  ciclismo: "/images/sports/ciclismo.jpg",
  formula1: "/images/sports/formula1.jpg",
  basquete: "/images/sports/basquete.jpg",
  beisebol: "/images/sports/beisebol.jpg",
  golfe: "/images/sports/golfe.jpg",
  surfe: "/images/sports/surfe.jpg",
};

const INVALID_ARTICLE_IDS = new Set([
  "newsroom-data-d1172bcb5b21",
]);

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 4));
}

function similar(a, b) {
  const left = tokens(a); const right = tokens(b); if (!left.size || !right.size) return false;
  let shared = 0; for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size >= 0.5;
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 82) || "materia-lap";
}

function humanizeLeague(value) {
  return String(value || "")
    .replace(/regular-season/gi, "temporada regular")
    .replace(/copa[-\s]+sul[-\s]+americana/gi, "Copa Sul-Americana")
    .replace(/copa[-\s]+libertadores/gi, "Copa Libertadores")
    .replace(/champions[-\s]+league/gi, "Champions League")
    .replace(/premier[-\s]+league/gi, "Premier League")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function footballCompetitionPhrase(league) {
  const material = normalize(league);
  if (/brasileirao|campeonato|mundial/.test(material)) return `pelo ${league}`;
  if (/copa|liga|champions|premier league|sul americana/.test(material)) return `pela ${league}`;
  return `pelo ${league}`;
}

function truncateAtWord(value, maxLength) {
  if (value.length <= maxLength) return value;
  const candidate = value.slice(0, maxLength + 1);
  const boundary = candidate.lastIndexOf(" ");
  return (boundary >= Math.floor(maxLength * 0.65) ? candidate.slice(0, boundary) : value.slice(0, maxLength)).trim();
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
}

function matchContext(event) {
  const parts = [];
  const date = formatDate(event.startTime);
  if (date) parts.push(`em ${date}`);
  if (event.venue) parts.push(`no ${event.venue}`);
  return parts.length ? `, ${parts.join(" ")}` : "";
}

function storyPriority(event, league) {
  const material = normalize(`${league} ${event.round || ""}`);
  if (/championship|super bowl|world series|conference final|nba finals|stanley cup final|grand final/.test(material)) return 82;
  if (/semifinal|quarterfinal|wild card|postseason|playoff|playoffs/.test(material)) return 76;
  return 58;
}

function footballCopy({ home, away, homeScore, awayScore, league, event }) {
  const context = matchContext(event);
  const competition = footballCompetitionPhrase(league);
  if (homeScore === awayScore) {
    const title = `${home} e ${away} ficam no ${homeScore} a ${awayScore} ${competition}`;
    const summary = `${home} e ${away} empataram por ${homeScore} a ${awayScore} ${competition}.`;
    const content = [
      `${home} e ${away} empataram por ${homeScore} a ${awayScore} ${competition}${context}. O resultado foi registrado como finalizado na cobertura ao vivo da LAP.`,
      `O placar não apontou vencedor. Para uma análise mais detalhada do desempenho das equipes, a redação aguarda estatísticas e informações adicionais confirmadas sobre a partida, evitando atribuir domínio, chances criadas ou acontecimentos que não estejam disponíveis nos dados verificados.`,
      `A cobertura da LAP mantém o resultado como referência do confronto e acompanha as próximas atualizações oficiais da competição e dos clubes envolvidos.`,
    ].join("\n\n");
    return { title, summary, content };
  }

  const winner = homeScore > awayScore ? home : away;
  const loser = homeScore > awayScore ? away : home;
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const title = `${winner} supera ${loser} por ${winnerScore} a ${loserScore} ${competition}`;
  const summary = `${winner} venceu ${loser} por ${winnerScore} a ${loserScore} ${competition}.`;
  const content = [
    `${winner} venceu ${loser} por ${winnerScore} a ${loserScore} ${competition}${context}. O confronto aparece como encerrado na cobertura ao vivo da LAP.`,
    `O resultado confirma a vitória de ${winner}, mas a LAP não atribui autores de gols, domínio, estatísticas ou lances decisivos sem que esses dados estejam disponíveis e validados. O objetivo é separar com clareza o que está confirmado do que ainda depende de apuração complementar.`,
    `A redação segue acompanhando informações oficiais da competição e das equipes para complementar a cobertura quando houver novos dados verificáveis sobre o confronto e seus desdobramentos.`,
  ].join("\n\n");
  return { title, summary, content };
}

function baseballCopy({ home, away, homeScore, awayScore, league, event }) {
  const context = matchContext(event);
  const winner = homeScore > awayScore ? home : away;
  const loser = homeScore > awayScore ? away : home;
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const title = `${winner} vence ${loser} por ${winnerScore} a ${loserScore} na ${league}`;
  const summary = `${winner} derrotou ${loser} por ${winnerScore} a ${loserScore} na ${league}.`;
  const content = [
    `${winner} derrotou ${loser} por ${winnerScore} a ${loserScore} na ${league}${context}. O jogo aparece como finalizado na cobertura ao vivo da LAP.`,
    `O placar confirma o resultado, mas não é suficiente para atribuir desempenho a pitchers, rebatedores, innings decisivos ou jogadas específicas. Esses elementos só entram na matéria quando estiverem disponíveis em fontes verificadas.`,
    `A LAP mantém o resultado publicado e acompanha as informações oficiais da MLB para atualizar a cobertura com estatísticas e contexto adicional quando houver dados confiáveis para isso.`,
  ].join("\n\n");
  return { title, summary, content };
}

function genericCopy({ home, away, homeScore, awayScore, league, label, event }) {
  const context = matchContext(event);
  const tied = homeScore === awayScore;
  const winner = tied ? null : homeScore > awayScore ? home : away;
  const loser = tied ? null : homeScore > awayScore ? away : home;
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const title = tied ? `${home} e ${away} empatam por ${homeScore} a ${awayScore} em ${league}` : `${winner} vence ${loser} por ${winnerScore} a ${loserScore} em ${league}`;
  const summary = tied ? `${home} e ${away} terminaram empatados por ${homeScore} a ${awayScore} em ${league}.` : `${winner} superou ${loser} por ${winnerScore} a ${loserScore} em ${league}.`;
  const content = [
    `${summary}${context}. O evento aparece como encerrado na cobertura ao vivo da LAP.`,
    `A matéria registra apenas os elementos confirmados no momento. Estatísticas, destaques individuais e contexto competitivo adicional só serão incluídos quando houver dados verificáveis suficientes.`,
    `A LAP acompanha a sequência da cobertura de ${label} e atualiza a informação conforme novas fontes confiáveis ficam disponíveis.`,
  ].join("\n\n");
  return { title, summary, content };
}

async function loadExisting() {
  try { const parsed = JSON.parse(await readFile(CONTENT_PATH, "utf8")); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

async function loadPayload() {
  const response = await fetch(`${SITE_URL}/api/live?refresh=1`, { headers: { "user-agent": "LAP Newsroom Data Stories/3.1" } });
  if (!response.ok) throw new Error(`API LAP respondeu ${response.status}`);
  return response.json();
}

function isSupportedFeed(feed) {
  return Object.prototype.hasOwnProperty.call(LABELS, feed.id);
}

function isNFL(feed, event) {
  return feed.id !== "futebol-americano" || /nfl/i.test(`${event.league || ""} ${event.round || ""}`);
}

function isEligibleCompletedEvent(event, now) {
  if (event.state !== "post" || !event.startTime) return false;
  const startedAt = new Date(event.startTime).getTime();
  if (!Number.isFinite(startedAt)) return false;
  const age = now - startedAt;
  return age >= -FUTURE_TOLERANCE_MS && age <= LOOKBACK_MS;
}

function buildStory(feed, event) {
  const homeScore = Number(event.home?.score);
  const awayScore = Number(event.away?.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || !event.home?.name || !event.away?.name) return null;

  const home = String(event.home.name);
  const away = String(event.away.name);
  const league = humanizeLeague(event.league || LABELS[feed.id]);
  const label = LABELS[feed.id];
  const copyArgs = { home, away, homeScore, awayScore, league, label, event };
  const editorial = feed.id === "futebol"
    ? footballCopy(copyArgs)
    : feed.id === "beisebol"
      ? baseballCopy(copyArgs)
      : genericCopy(copyArgs);

  const { title, summary, content } = editorial;
  const digest = createHash("sha1").update(`${feed.id}|${event.id}|${title}`).digest("hex").slice(0, 12);
  const stamp = new Date().toISOString();
  const sourceUrl = `${SITE_URL}/modalidades/${feed.id}`;

  return {
    id: `newsroom-data-${digest}`,
    slug: `${slugify(title)}-${digest.slice(0, 6)}`,
    sportId: feed.id,
    title,
    summary,
    content,
    sourceName: "LAP Dados",
    sourceUrl,
    coverImageUrl: COVER_IMAGES[feed.id] || null,
    authorName: "Redação LAP",
    authorRole: `Newsroom AI · ${label}`,
    tags: [slugify(label), "resultado", slugify(league)],
    seoTitle: truncateAtWord(title, 70),
    seoDescription: summary.slice(0, 170),
    status: "published",
    scheduledAt: null,
    publishedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
    homepagePriority: storyPriority(event, league),
    breaking: false,
    agentId: feed.id,
    sourceUrls: [sourceUrl],
    verifiedFacts: 2,
    dataDriven: true,
    provenance: {
      provider: "LAP live-data",
      eventId: String(event.id || ""),
      eventStartTime: event.startTime,
      retrievedAt: stamp,
      feedId: feed.id,
      league: event.league || null,
    },
  };
}

async function main() {
  const [rawExisting, payload] = await Promise.all([loadExisting(), loadPayload()]);
  const now = Date.now();
  const existing = rawExisting.filter((article) => !INVALID_ARTICLE_IDS.has(article?.id));
  const stories = [];

  for (const feed of Array.isArray(payload?.feeds) ? payload.feeds : []) {
    if (!isSupportedFeed(feed)) continue;
    const completed = (Array.isArray(feed.scores) ? feed.scores : [])
      .filter((event) => isEligibleCompletedEvent(event, now) && isNFL(feed, event))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    for (const event of completed) {
      const story = buildStory(feed, event);
      if (!story || [...existing, ...stories].some((article) => similar(article.title || "", story.title))) continue;
      stories.push(story);
      break;
    }
    if (stories.length >= MAX_NEW_ARTICLES) break;
  }

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const next = [...stories, ...existing]
    .filter((article) => !article.publishedAt || new Date(article.publishedAt).getTime() >= cutoff)
    .slice(0, MAX_STORED_ARTICLES);

  if (!stories.length && next.length === rawExisting.length && next.every((article, index) => article?.id === rawExisting[index]?.id)) {
    console.log("Nenhum resultado novo elegível e nenhuma limpeza necessária nesta rodada.");
    return;
  }

  await writeFile(CONTENT_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    stage: "dataStories",
    published: stories.length,
    removedInvalid: rawExisting.length - existing.length,
    titles: stories.map((story) => story.title),
  }));
}

main().catch((error) => {
  console.error("Falha ao produzir matérias de dados da LAP:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
