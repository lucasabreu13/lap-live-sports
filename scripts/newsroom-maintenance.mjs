import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_PATH = path.join(process.cwd(), "content", "newsroom", "articles.json");
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;
const UPDATE_WINDOW_MS = 36 * 60 * 60 * 1000;
const MAX_STORED_ARTICLES = 300;

const STOPWORDS = new Set(["para", "com", "sem", "sobre", "entre", "apos", "após", "antes", "mais", "menos", "pela", "pelo", "pelos", "pelas", "uma", "dos", "das", "que", "the", "and", "from", "with", "em", "por", "na", "no", "nas", "nos"]);

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value = "") {
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 4 && !STOPWORDS.has(token)));
}

function similarity(a, b) {
  const left = tokens(a); const right = tokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(1, Math.min(left.size, right.size));
}

function time(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isFutureDataStory(article, now) {
  const eventStart = article?.provenance?.eventStartTime;
  return Boolean(article?.dataDriven && eventStart && time(eventStart) > now + FUTURE_TOLERANCE_MS);
}

function sameStory(a, b) {
  if (!a || !b || a.sportId !== b.sportId) return false;
  const publishedGap = Math.abs(time(a.publishedAt) - time(b.publishedAt));
  if (publishedGap > UPDATE_WINDOW_MS) return false;
  return similarity(a.title, b.title) >= 0.72;
}

function mergeLivingStory(older, newer) {
  return {
    ...older,
    title: newer.title || older.title,
    summary: newer.summary || older.summary,
    content: newer.content || older.content,
    seoTitle: newer.seoTitle || older.seoTitle,
    seoDescription: newer.seoDescription || older.seoDescription,
    coverImageUrl: newer.coverImageUrl || older.coverImageUrl,
    sourceName: newer.sourceName || older.sourceName,
    sourceUrl: newer.sourceUrl || older.sourceUrl,
    sourceUrls: [...new Set([...(older.sourceUrls || []), ...(newer.sourceUrls || [])])].slice(0, 12),
    tags: [...new Set([...(older.tags || []), ...(newer.tags || [])])].slice(0, 16),
    homepagePriority: Math.max(Number(older.homepagePriority) || 0, Number(newer.homepagePriority) || 0),
    breaking: Boolean(older.breaking || newer.breaking),
    verifiedFacts: Math.max(Number(older.verifiedFacts) || 0, Number(newer.verifiedFacts) || 0),
    updatedAt: newer.updatedAt || newer.publishedAt || new Date().toISOString(),
    editorialPolished: newer.editorialPolished ?? older.editorialPolished,
    editorialDesk: newer.editorialDesk || older.editorialDesk,
    provenance: newer.provenance || older.provenance,
    updateHistory: [
      ...(Array.isArray(older.updateHistory) ? older.updateHistory : []),
      { updatedAt: newer.updatedAt || newer.publishedAt || new Date().toISOString(), sourceArticleId: newer.id },
    ].slice(-20),
  };
}

async function main() {
  const raw = await readFile(CONTENT_PATH, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Arquivo de matérias inválido.");

  const now = Date.now();
  const cleaned = parsed.filter((article) => !isFutureDataStory(article, now));
  const sorted = [...cleaned].sort((a, b) => time(a.publishedAt) - time(b.publishedAt));
  const consolidated = [];
  let merged = 0;

  for (const article of sorted) {
    const index = consolidated.findIndex((existing) => sameStory(existing, article));
    if (index === -1) {
      consolidated.push(article);
      continue;
    }
    consolidated[index] = mergeLivingStory(consolidated[index], article);
    merged += 1;
  }

  const next = consolidated
    .sort((a, b) => time(b.updatedAt || b.publishedAt) - time(a.updatedAt || a.publishedAt))
    .slice(0, MAX_STORED_ARTICLES);

  const removedFuture = parsed.length - cleaned.length;
  const changed = removedFuture > 0 || merged > 0 || next.length !== parsed.length;
  if (changed) await writeFile(CONTENT_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ stage: "maintenance", removedFuture, mergedLivingStories: merged, stored: next.length }));
}

main().catch((error) => {
  console.error("Falha na manutenção editorial da LAP:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
