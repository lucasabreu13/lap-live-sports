import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const NEWSROOM_DIR = path.join(process.cwd(), "content", "newsroom");
const AUTO_PATH = path.join(NEWSROOM_DIR, "articles.json");
const OVERRIDES_PATH = path.join(NEWSROOM_DIR, "editorial-overrides.json");
const MAX_STORED_ARTICLES = 300;

async function readArray(file) {
  try {
    const parsed = JSON.parse(await readFile(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function key(article) {
  return article?.slug || article?.id || "";
}

function articleTime(article) {
  const value = new Date(article?.updatedAt || article?.publishedAt || article?.createdAt || 0).getTime();
  return Number.isFinite(value) ? value : 0;
}

function applyOverrides(articles, overrides) {
  const byId = new Map();
  const bySlug = new Map();
  for (const override of overrides) {
    if (override?.id) byId.set(String(override.id), override);
    if (override?.slug) bySlug.set(String(override.slug), override);
  }
  return articles.map((article) => {
    const override = byId.get(String(article?.id || "")) || bySlug.get(String(article?.slug || ""));
    return override ? { ...article, ...override } : article;
  });
}

function newestByKey(articles) {
  const byKey = new Map();
  for (const article of articles) {
    const articleKey = key(article);
    if (!articleKey) continue;
    const current = byKey.get(articleKey);
    if (!current || articleTime(article) >= articleTime(current)) byKey.set(articleKey, article);
  }
  return [...byKey.values()];
}

async function curatedFiles() {
  const names = await readdir(NEWSROOM_DIR);
  return names
    .filter((name) => /^curated-articles.*\.json$/i.test(name))
    .sort()
    .map((name) => path.join(NEWSROOM_DIR, name));
}

async function main() {
  const files = await curatedFiles();
  const [automatedRaw, overrides, ...curatedPayloads] = await Promise.all([
    readArray(AUTO_PATH),
    readArray(OVERRIDES_PATH),
    ...files.map(readArray),
  ]);

  const automated = applyOverrides(automatedRaw, overrides);
  const curated = newestByKey(applyOverrides(curatedPayloads.flat(), overrides));
  const curatedKeys = new Set(curated.map(key).filter(Boolean));
  const combined = [
    ...curated,
    ...automated.filter((article) => !curatedKeys.has(key(article))),
  ]
    .filter((article) => key(article))
    .sort((a, b) => new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime())
    .slice(0, MAX_STORED_ARTICLES);

  const next = `${JSON.stringify(combined, null, 2)}\n`;
  const currentText = `${JSON.stringify(automatedRaw, null, 2)}\n`;
  if (next === currentText) {
    console.log(JSON.stringify({ stage: "curatedMerge", changed: false, curated: curated.length, curatedFiles: files.length, overrides: overrides.length }));
    return;
  }

  await writeFile(AUTO_PATH, next, "utf8");
  console.log(JSON.stringify({ stage: "curatedMerge", changed: true, curated: curated.length, curatedFiles: files.length, overrides: overrides.length, total: combined.length }));
}

main().catch((error) => {
  console.error("Falha ao incorporar curadoria verificada ao newsroom:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
