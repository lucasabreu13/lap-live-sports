import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const AUTO_PATH = path.join(process.cwd(), "content", "newsroom", "articles.json");
const CURATED_PATH = path.join(process.cwd(), "content", "newsroom", "curated-articles.json");
const MAX_STORED_ARTICLES = 300;

async function readArticles(file) {
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

async function main() {
  const [automated, curated] = await Promise.all([readArticles(AUTO_PATH), readArticles(CURATED_PATH)]);
  const curatedKeys = new Set(curated.map(key).filter(Boolean));
  const combined = [
    ...curated,
    ...automated.filter((article) => !curatedKeys.has(key(article))),
  ]
    .filter((article) => key(article))
    .sort((a, b) => new Date(b.publishedAt || b.createdAt || 0).getTime() - new Date(a.publishedAt || a.createdAt || 0).getTime())
    .slice(0, MAX_STORED_ARTICLES);

  const next = `${JSON.stringify(combined, null, 2)}\n`;
  const currentText = `${JSON.stringify(automated, null, 2)}\n`;
  if (next === currentText) {
    console.log(JSON.stringify({ stage: "curatedMerge", changed: false, curated: curated.length }));
    return;
  }

  await writeFile(AUTO_PATH, next, "utf8");
  console.log(JSON.stringify({ stage: "curatedMerge", changed: true, curated: curated.length, total: combined.length }));
}

main().catch((error) => {
  console.error("Falha ao incorporar curadoria verificada ao newsroom:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
