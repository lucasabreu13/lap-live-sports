import curatedArticlesPayload from "@/content/newsroom/curated-articles.json";
import curatedArticles20260724Payload from "@/content/newsroom/curated-articles-20260724.json";
import curatedCorinthians20260724Payload from "@/content/newsroom/curated-articles-corinthians-20260724.json";
import curatedLeBron20260724Payload from "@/content/newsroom/curated-articles-lebron-20260724.json";
import editorialOverridesPayload from "@/content/newsroom/editorial-overrides.json";
import type { EditorialArticle } from "@/lib/editorial-store";
import type { LivePayload, NewsItem, SportId } from "@/lib/live-data";

export type NewsroomEditorialArticle = EditorialArticle & {
  homepagePriority?: number;
  breaking?: boolean;
  agentId?: string;
  sourceUrls?: string[];
  articleFormat?: "result-brief" | "full";
};

const DEFAULT_CONTENT_URL = "https://raw.githubusercontent.com/lucasabreu13/lap-live-sports/main/content/newsroom/articles.json";
export const NEWSROOM_ACTIVE_WINDOW_MS = 72 * 60 * 60 * 1000;
const FUTURE_CLOCK_TOLERANCE_MS = 5 * 60 * 1000;
const NON_HEAD_TO_HEAD_SPORTS = new Set(["formula1", "ciclismo", "golfe", "surfe"]);

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord {
  return value && typeof value === "object" ? value as AnyRecord : {};
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asNullableString(value: unknown) {
  const text = asString(value).trim();
  return text || null;
}

const EDITORIAL_OVERRIDES = (editorialOverridesPayload as unknown[]).map(asRecord);
const OVERRIDES_BY_KEY = new Map<string, AnyRecord>();
for (const override of EDITORIAL_OVERRIDES) {
  const id = asString(override.id).trim();
  const slug = asString(override.slug).trim();
  if (id) OVERRIDES_BY_KEY.set(`id:${id}`, override);
  if (slug) OVERRIDES_BY_KEY.set(`slug:${slug}`, override);
}

function applyEditorialOverride(value: unknown) {
  const row = asRecord(value);
  const id = asString(row.id).trim();
  const slug = asString(row.slug).trim();
  const override = (id && OVERRIDES_BY_KEY.get(`id:${id}`)) || (slug && OVERRIDES_BY_KEY.get(`slug:${slug}`));
  return override ? { ...row, ...override } : row;
}

function looksLikeInvalidHeadToHeadResult(sportId: string, articleFormat: string, text: string) {
  if (articleFormat !== "result-brief" || !NON_HEAD_TO_HEAD_SPORTS.has(sportId)) return false;
  return /\b(?:empata(?:m|ram)?|vence(?:m|ram)?|supera(?:m|ram)?)\b[\s\S]{0,120}\bpor\s+\d+\s+a\s+\d+\b/i.test(text);
}

function normalizeArticle(value: unknown): NewsroomEditorialArticle | null {
  const row = asRecord(value);
  const id = asString(row.id).trim();
  const slug = asString(row.slug).trim();
  const sportId = asString(row.sportId).trim();
  const title = asString(row.title).trim();
  const summary = asString(row.summary).trim();
  const content = asString(row.content).trim();
  const rawFormat = asString(row.articleFormat).trim();
  if (!id || !slug || !sportId || !title || !summary || !content) return null;
  if (asString(row.status, "published") !== "published") return null;
  if (looksLikeInvalidHeadToHeadResult(sportId, rawFormat, `${title} ${summary}`)) return null;

  const now = new Date().toISOString();
  const publishedAt = asNullableString(row.publishedAt) || now;
  const createdAt = asNullableString(row.createdAt) || publishedAt;
  const updatedAt = asNullableString(row.updatedAt) || createdAt;
  const priority = Number(row.homepagePriority);
  const articleFormat = rawFormat === "result-brief" ? "result-brief" : rawFormat === "full" ? "full" : undefined;

  return {
    id,
    slug,
    sportId,
    title,
    summary,
    content,
    sourceName: asNullableString(row.sourceName),
    sourceUrl: asNullableString(row.sourceUrl),
    coverImageUrl: asNullableString(row.coverImageUrl),
    authorName: asNullableString(row.authorName) || "Redação LAP",
    authorRole: asNullableString(row.authorRole) || "Newsroom AI",
    tags: asStringArray(row.tags),
    seoTitle: asNullableString(row.seoTitle),
    seoDescription: asNullableString(row.seoDescription),
    status: "published",
    scheduledAt: null,
    publishedAt,
    createdAt,
    updatedAt,
    homepagePriority: Number.isFinite(priority) ? Math.max(0, Math.min(100, priority)) : 50,
    breaking: Boolean(row.breaking),
    agentId: asNullableString(row.agentId) || undefined,
    sourceUrls: asStringArray(row.sourceUrls),
    articleFormat,
  };
}

function articleTimestamp(article: Pick<NewsroomEditorialArticle, "publishedAt" | "createdAt">) {
  return new Date(article.publishedAt || article.createdAt).getTime();
}

export function isNewsroomArticleActive(article: Pick<NewsroomEditorialArticle, "publishedAt" | "createdAt">, now = Date.now()) {
  const timestamp = articleTimestamp(article);
  if (!Number.isFinite(timestamp)) return false;
  const ageMs = now - timestamp;
  return ageMs >= -FUTURE_CLOCK_TOLERANCE_MS && ageMs <= NEWSROOM_ACTIVE_WINDOW_MS;
}

function editorialScore(article: NewsroomEditorialArticle) {
  const timestamp = articleTimestamp(article);
  const ageHours = Number.isFinite(timestamp) ? Math.max(0, (Date.now() - timestamp) / 3_600_000) : 999;
  const priority = article.homepagePriority ?? 50;
  const breakingBoost = article.breaking && ageHours <= 12 ? 35 : article.breaking && ageHours <= 24 ? 15 : 0;
  const freshnessBoost = Math.max(0, 24 - ageHours) * 1.5;
  const agePenalty = Math.max(0, ageHours - 24) * 0.35;
  return priority + breakingBoost + freshnessBoost - agePenalty;
}

function orderArticles(items: NewsroomEditorialArticle[], limit: number) {
  return Array.from(new Map(items.map((article) => [article.slug, article])).values())
    .sort((a, b) => {
      const scoreDiff = editorialScore(b) - editorialScore(a);
      if (Math.abs(scoreDiff) > 0.001) return scoreDiff;
      return articleTimestamp(b) - articleTimestamp(a);
    })
    .slice(0, Math.max(1, Math.min(limit, 250)));
}

function getCuratedArticles() {
  const curatedPayloads = [
    ...(curatedArticlesPayload as unknown[]),
    ...(curatedArticles20260724Payload as unknown[]),
    ...(curatedCorinthians20260724Payload as unknown[]),
    ...(curatedLeBron20260724Payload as unknown[]),
  ];

  return curatedPayloads
    .map(applyEditorialOverride)
    .map(normalizeArticle)
    .filter((article): article is NewsroomEditorialArticle => article !== null);
}

async function getAllNewsroomArticles(limit = 250): Promise<NewsroomEditorialArticle[]> {
  const url = process.env.NEWSROOM_CONTENT_URL || DEFAULT_CONTENT_URL;
  const curated = getCuratedArticles();
  let automated: NewsroomEditorialArticle[] = [];

  try {
    const response = await fetch(url, {
      next: { revalidate: 120 },
      headers: { "user-agent": "LAP Live Sports Newsroom Reader/1.5" },
    });
    if (response.ok) {
      const payload = await response.json() as unknown;
      if (Array.isArray(payload)) {
        automated = payload
          .map(applyEditorialOverride)
          .map(normalizeArticle)
          .filter((article): article is NewsroomEditorialArticle => article !== null);
      }
    }
  } catch {
    // A curadoria embarcada continua disponível mesmo se o arquivo remoto falhar.
  }

  // Curadoria verificada é aplicada por último para prevalecer em eventual slug duplicado.
  return orderArticles([...automated, ...curated], limit);
}

export async function getNewsroomArticles(limit = 48): Promise<NewsroomEditorialArticle[]> {
  const all = await getAllNewsroomArticles(250);
  // Política editorial LAP: notícias ocupam home e páginas de modalidade por 72 horas.
  // Depois disso deixam a vitrine gradualmente, mas a URL permanente da matéria continua acessível.
  return orderArticles(all.filter((article) => isNewsroomArticleActive(article)), limit);
}

export async function getNewsroomArticleBySlug(slug: string): Promise<NewsroomEditorialArticle | null> {
  // Busca o arquivo completo para preservar URLs antigas mesmo depois da janela de 72 horas.
  const articles = await getAllNewsroomArticles(250);
  return articles.find((article) => article.slug === slug) ?? null;
}

export function newsroomArticleToNewsItem(article: NewsroomEditorialArticle): NewsItem {
  return {
    id: article.id,
    kind: "editorial",
    slug: article.slug,
    sportId: article.sportId as SportId,
    title: article.title,
    excerpt: article.summary,
    source: article.breaking ? "LAP · Urgente" : article.articleFormat === "result-brief" ? "LAP · Resultado rápido" : "LAP",
    url: article.sourceUrl,
    publishedAt: article.publishedAt,
    internalUrl: `/materias/${article.slug}`,
    imageUrl: article.coverImageUrl,
    imageAlt: article.title,
  };
}
