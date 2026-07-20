import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_PATH = path.join(process.cwd(), "content", "newsroom", "articles.json");
const SITE_URL = process.env.LAP_SITE_URL || "https://lap-live-sports.vercel.app";
const LOOKBACK_MS = 36 * 60 * 60 * 1000;
const MAX_NEW_ARTICLES = 4;
const MAX_STORED_ARTICLES = 300;

const LABELS = {
  futebol: "Futebol",
  "futebol-americano": "NFL",
  basquete: "NBA",
  beisebol: "MLB",
};

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

async function loadExisting() {
  try { const parsed = JSON.parse(await readFile(CONTENT_PATH, "utf8")); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

async function loadPayload() {
  const response = await fetch(`${SITE_URL}/api/live?refresh=1`, { headers: { "user-agent": "LAP Newsroom Data Stories/1.0" } });
  if (!response.ok) throw new Error(`API LAP respondeu ${response.status}`);
  return response.json();
}

function isSupportedFeed(feed) {
  return Object.prototype.hasOwnProperty.call(LABELS, feed.id);
}

function isNFL(feed, event) {
  return feed.id !== "futebol-americano" || /nfl/i.test(`${event.league || ""} ${event.round || ""}`);
}

function buildStory(feed, event) {
  const homeScore = Number(event.home?.score);
  const awayScore = Number(event.away?.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || !event.home?.name || !event.away?.name) return null;

  const home = String(event.home.name);
  const away = String(event.away.name);
  const league = String(event.league || LABELS[feed.id]);
  const label = LABELS[feed.id];
  let title;
  let lead;

  if (homeScore === awayScore) {
    title = `${home} e ${away} empatam por ${homeScore} a ${awayScore} em ${league}`;
    lead = `${home} e ${away} terminaram empatados por ${homeScore} a ${awayScore} em confronto de ${league}.`;
  } else {
    const winner = homeScore > awayScore ? home : away;
    const loser = homeScore > awayScore ? away : home;
    const winnerScore = Math.max(homeScore, awayScore);
    const loserScore = Math.min(homeScore, awayScore);
    title = `${winner} vence ${loser} por ${winnerScore} a ${loserScore} em ${league}`;
    lead = `${winner} venceu ${loser} por ${winnerScore} a ${loserScore} em resultado confirmado pela cobertura de dados da LAP.`;
  }

  const digest = createHash("sha1").update(`${feed.id}|${event.id}|${title}`).digest("hex").slice(0, 12);
  const stamp = new Date().toISOString();
  const summary = `${lead} O evento consta como encerrado na base esportiva estruturada usada pela LAP.`;

  return {
    id: `newsroom-data-${digest}`,
    slug: `${slugify(title)}-${digest.slice(0, 6)}`,
    sportId: feed.id,
    title,
    summary,
    content: `${lead}\n\nO confronto aparece com status finalizado e placar registrado na fonte esportiva estruturada que alimenta a central de ${label} da LAP.\n\nEsta é uma matéria produzida pela Redação LAP a partir de dados esportivos confirmados. A cobertura será atualizada quando novos dados oficiais ficarem disponíveis.`,
    sourceName: "LAP Dados",
    sourceUrl: `${SITE_URL}/modalidades/${feed.id}`,
    coverImageUrl: null,
    authorName: "Redação LAP",
    authorRole: `Newsroom AI · ${label}`,
    tags: [slugify(label), "resultado", slugify(league)],
    seoTitle: title.slice(0, 70),
    seoDescription: summary.slice(0, 170),
    status: "published",
    scheduledAt: null,
    publishedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
    homepagePriority: 62,
    breaking: false,
    agentId: feed.id,
    sourceUrls: [`${SITE_URL}/modalidades/${feed.id}`],
    verifiedFacts: 2,
    dataDriven: true,
  };
}

async function main() {
  const [existing, payload] = await Promise.all([loadExisting(), loadPayload()]);
  const now = Date.now();
  const stories = [];

  for (const feed of Array.isArray(payload?.feeds) ? payload.feeds : []) {
    if (!isSupportedFeed(feed)) continue;
    const completed = (Array.isArray(feed.scores) ? feed.scores : [])
      .filter((event) => event.state === "post" && event.startTime && now - new Date(event.startTime).getTime() <= LOOKBACK_MS && isNFL(feed, event))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    for (const event of completed) {
      const story = buildStory(feed, event);
      if (!story || [...existing, ...stories].some((article) => similar(article.title || "", story.title))) continue;
      stories.push(story);
      break;
    }
    if (stories.length >= MAX_NEW_ARTICLES) break;
  }

  if (!stories.length) {
    console.log("Nenhum resultado novo elegível para matéria própria nesta rodada.");
    return;
  }

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const next = [...stories, ...existing]
    .filter((article) => !article.publishedAt || new Date(article.publishedAt).getTime() >= cutoff)
    .slice(0, MAX_STORED_ARTICLES);

  await writeFile(CONTENT_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`Publicadas ${stories.length} matérias autorais baseadas em dados: ${stories.map((story) => story.title).join(" | ")}`);
}

main().catch((error) => {
  console.error("Falha ao produzir matérias de dados da LAP:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
