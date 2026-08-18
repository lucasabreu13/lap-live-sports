import type { NewsItem, SportId } from "@/lib/live-data";

type JsonRecord = Record<string, unknown>;

const ESPN_NEWS_PATHS: Array<[SportId, string]> = [
  ["futebol", "soccer/bra.1"],
  ["futebol", "soccer/eng.1"],
  ["futebol", "soccer/uefa.champions"],
  ["futebol-americano", "football/nfl"],
  ["formula1", "racing/f1"],
  ["basquete", "basketball/nba"],
  ["tenis", "tennis/atp"],
  ["beisebol", "baseball/mlb"],
  ["mma", "mma/ufc"],
];

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function hash(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function encodeTransport(value: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function parseArticles(payload: unknown, sportId: SportId): NewsItem[] {
  const articles = Array.isArray(record(payload).articles) ? record(payload).articles as JsonRecord[] : [];
  return articles.flatMap((article, index) => {
    const title = text(article.headline).trim();
    const excerpt = text(article.description).trim();
    const publishedAt = text(article.published) || null;
    const url = text(record(record(article.links).web).href);
    const images = Array.isArray(article.images) ? article.images as JsonRecord[] : [];
    const selectedImage = images.find((image) => /^https:\/\/(a\.espncdn\.com|espnmedia-cdn\.akamaized\.net)\//i.test(text(image.url)));
    const imageUrl = text(selectedImage?.url);
    if (!title || !excerpt || !url || !imageUrl || !publishedAt) return [];

    const ageMs = Date.now() - new Date(publishedAt).getTime();
    if (!Number.isFinite(ageMs) || ageMs < -5 * 60_000 || ageMs > 4 * 24 * 60 * 60_000) return [];
    try {
      const source = new URL(url);
      if (source.protocol !== "https:" || !source.hostname.endsWith("espn.com.br")) return [];
    } catch {
      return [];
    }

    const slug = hash(`${url}|${title}`);
    const transport = {
      slug,
      sportId,
      title,
      excerpt,
      source: "ESPN Brasil",
      url,
      publishedAt,
      imageUrl,
      imageAlt: text(selectedImage?.caption) || title,
    };
    return [{
      id: `browser-espn-${sportId}-${index}-${slug}`,
      kind: "brief" as const,
      ...transport,
      internalUrl: `/materias/${slug}?d=${encodeTransport(transport)}`,
    }];
  });
}

async function fetchPath([sportId, path]: [SportId, string]) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/${path}/news?limit=12&region=br&lang=pt`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return [];
    return parseArticles(await response.json(), sportId);
  } catch {
    return [];
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchBrowserSportsNews() {
  const results = await Promise.all(ESPN_NEWS_PATHS.map(fetchPath));
  return Array.from(new Map(results.flat().map((item) => [item.url || item.slug, item])).values())
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime())
    .slice(0, 48);
}
