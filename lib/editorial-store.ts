export type EditorialArticleStatus = "draft" | "in_review" | "scheduled" | "published" | "archived";
export type EditorialRole = "admin" | "editor" | "writer";

export type EditorialArticle = {
  id: string;
  slug: string;
  sportId: string;
  title: string;
  summary: string;
  content: string;
  sourceName: string | null;
  sourceUrl: string | null;
  coverImageUrl: string | null;
  authorName: string | null;
  authorRole: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  status: EditorialArticleStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateEditorialArticleInput = {
  title: string;
  summary: string;
  content: string;
  sportId: string;
  sourceName?: string | null;
  sourceUrl?: string | null;
  coverImageUrl?: string | null;
  authorName?: string | null;
  authorRole?: string | null;
  tags?: string[] | string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  status?: EditorialArticleStatus;
  scheduledAt?: string | null;
  publishedAt?: string | null;
  slug?: string | null;
};

export type UpdateEditorialArticleInput = Partial<CreateEditorialArticleInput> & { id: string };

type SupabaseArticleRow = {
  id: string;
  slug: string;
  sport_id: string;
  title: string;
  summary: string;
  content: string;
  source_name: string | null;
  source_url: string | null;
  cover_image_url: string | null;
  author_name: string | null;
  author_role: string | null;
  tags: string[] | null;
  seo_title: string | null;
  seo_description: string | null;
  status: EditorialArticleStatus;
  scheduled_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseConfig = { url: string; serviceRoleKey: string };

const ALLOWED_STATUSES: EditorialArticleStatus[] = ["draft", "in_review", "scheduled", "published", "archived"];
const ARTICLE_SELECT = [
  "id", "slug", "sport_id", "title", "summary", "content", "source_name", "source_url", "cover_image_url",
  "author_name", "author_role", "tags", "seo_title", "seo_description", "status", "scheduled_at", "published_at", "created_at", "updated_at",
].join(",");

function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

function mapArticle(row: SupabaseArticleRow): EditorialArticle {
  return {
    id: row.id,
    slug: row.slug,
    sportId: row.sport_id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    coverImageUrl: row.cover_image_url,
    authorName: row.author_name,
    authorRole: row.author_role,
    tags: Array.isArray(row.tags) ? row.tags : [],
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeWhitespace(value: string | null | undefined) {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function normalizeOptionalUrl(value: string | null | undefined) {
  const candidate = normalizeWhitespace(value);
  if (!candidate) return null;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeDate(value: string | null | undefined) {
  const candidate = normalizeWhitespace(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeTags(value: string[] | string | null | undefined) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return [...new Set(raw.map((tag) => normalizeWhitespace(tag).toLowerCase()).filter(Boolean))].slice(0, 12);
}

function resolveStatus(input: CreateEditorialArticleInput) {
  const candidate = input.status && ALLOWED_STATUSES.includes(input.status) ? input.status : "draft";
  const scheduledAt = normalizeDate(input.scheduledAt);
  if (candidate === "scheduled" && !scheduledAt) throw new Error("Informe data e hora para o agendamento.");
  if (candidate === "scheduled" && scheduledAt && new Date(scheduledAt).getTime() <= Date.now()) return { status: "published" as const, scheduledAt, publishedAt: scheduledAt };
  return {
    status: candidate,
    scheduledAt: candidate === "scheduled" ? scheduledAt : null,
    publishedAt: candidate === "published" ? normalizeDate(input.publishedAt) || new Date().toISOString() : null,
  };
}

export function slugify(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
  return normalized || "materia-lap";
}

async function supabaseRequest(path: string, init?: RequestInit) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Banco editorial não configurado.");
  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha no banco editorial (${response.status}): ${detail}`);
  }
  return response;
}

async function recordVersion(article: EditorialArticle, action: string) {
  try {
    await supabaseRequest("lap_article_versions", {
      method: "POST",
      body: JSON.stringify({
        article_id: article.id,
        action,
        snapshot: {
          title: article.title,
          summary: article.summary,
          content: article.content,
          status: article.status,
          tags: article.tags,
          updated_at: article.updatedAt,
        },
      }),
    });
  } catch {
    // A tabela de histórico é opcional para instalações anteriores; a matéria não deve deixar de salvar.
  }
}

export function isEditorialStoreConfigured() {
  return Boolean(getSupabaseConfig());
}

async function publishDueScheduledArticles() {
  if (!getSupabaseConfig()) return;
  const now = new Date().toISOString();
  const params = new URLSearchParams({ status: "eq.scheduled", scheduled_at: `lte.${now}` });
  await supabaseRequest(`lap_articles?${params.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ status: "published", published_at: now }),
  }).catch(() => undefined);
}

export async function getPublishedEditorialArticles(limit = 8): Promise<EditorialArticle[]> {
  if (!getSupabaseConfig()) return [];
  await publishDueScheduledArticles();
  const query = new URLSearchParams({
    select: ARTICLE_SELECT,
    status: "eq.published",
    order: "published_at.desc.nullslast,created_at.desc",
    limit: String(Math.max(1, Math.min(limit, 48))),
  });
  const response = await supabaseRequest(`lap_articles?${query.toString()}`);
  return (await response.json() as SupabaseArticleRow[]).map(mapArticle);
}

export async function getEditorialArticlesForAdmin(limit = 60): Promise<EditorialArticle[]> {
  if (!getSupabaseConfig()) return [];
  const query = new URLSearchParams({
    select: ARTICLE_SELECT,
    order: "updated_at.desc",
    limit: String(Math.max(1, Math.min(limit, 100))),
  });
  const response = await supabaseRequest(`lap_articles?${query.toString()}`);
  return (await response.json() as SupabaseArticleRow[]).map(mapArticle);
}

export async function findEditorialArticleBySlug(slug: string): Promise<EditorialArticle | null> {
  if (!getSupabaseConfig()) return null;
  await publishDueScheduledArticles();
  const query = new URLSearchParams({ select: ARTICLE_SELECT, slug: `eq.${slug}`, status: "eq.published", limit: "1" });
  const response = await supabaseRequest(`lap_articles?${query.toString()}`);
  const rows = await response.json() as SupabaseArticleRow[];
  return rows[0] ? mapArticle(rows[0]) : null;
}

function buildCreatePayload(input: CreateEditorialArticleInput) {
  const title = normalizeWhitespace(input.title);
  const summary = normalizeWhitespace(input.summary);
  const content = input.content.replace(/\r\n/g, "\n").trim();
  const sportId = normalizeWhitespace(input.sportId);
  if (title.length < 8) throw new Error("O título precisa ter pelo menos 8 caracteres.");
  if (summary.length < 20) throw new Error("O resumo precisa ter pelo menos 20 caracteres.");
  if (content.length < 80) throw new Error("O texto da matéria precisa ter pelo menos 80 caracteres.");
  if (!sportId) throw new Error("Selecione uma modalidade para a matéria.");

  const sourceUrl = normalizeOptionalUrl(input.sourceUrl);
  if (normalizeWhitespace(input.sourceUrl) && !sourceUrl) throw new Error("A URL da fonte precisa começar com http:// ou https://.");
  const coverImageUrl = normalizeOptionalUrl(input.coverImageUrl);
  if (normalizeWhitespace(input.coverImageUrl) && !coverImageUrl) throw new Error("A URL da imagem precisa começar com http:// ou https://.");
  const { status, scheduledAt, publishedAt } = resolveStatus(input);

  return {
    slug: slugify(input.slug || title),
    sport_id: sportId,
    title,
    summary,
    content,
    source_name: normalizeWhitespace(input.sourceName) || null,
    source_url: sourceUrl,
    cover_image_url: coverImageUrl,
    author_name: normalizeWhitespace(input.authorName) || "LAP",
    author_role: normalizeWhitespace(input.authorRole) || "Redação LAP",
    tags: normalizeTags(input.tags),
    seo_title: normalizeWhitespace(input.seoTitle) || null,
    seo_description: normalizeWhitespace(input.seoDescription) || null,
    status,
    scheduled_at: scheduledAt,
    published_at: publishedAt,
  };
}

export async function createEditorialArticle(input: CreateEditorialArticleInput): Promise<EditorialArticle> {
  const payload = buildCreatePayload(input);
  const response = await supabaseRequest("lap_articles", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const rows = await response.json() as SupabaseArticleRow[];
  if (!rows[0]) throw new Error("A matéria não foi devolvida pelo banco editorial.");
  const article = mapArticle(rows[0]);
  await recordVersion(article, "created");
  return article;
}

export async function updateEditorialArticle(input: UpdateEditorialArticleInput): Promise<EditorialArticle> {
  if (!input.id) throw new Error("Matéria inválida.");
  const fields: Record<string, unknown> = {};
  if (input.title !== undefined) fields.title = normalizeWhitespace(input.title);
  if (input.summary !== undefined) fields.summary = normalizeWhitespace(input.summary);
  if (input.content !== undefined) fields.content = input.content.replace(/\r\n/g, "\n").trim();
  if (input.sportId !== undefined) fields.sport_id = normalizeWhitespace(input.sportId);
  if (input.slug !== undefined) fields.slug = slugify(input.slug || "materia-lap");
  if (input.sourceName !== undefined) fields.source_name = normalizeWhitespace(input.sourceName) || null;
  if (input.authorName !== undefined) fields.author_name = normalizeWhitespace(input.authorName) || "LAP";
  if (input.authorRole !== undefined) fields.author_role = normalizeWhitespace(input.authorRole) || "Redação LAP";
  if (input.tags !== undefined) fields.tags = normalizeTags(input.tags);
  if (input.seoTitle !== undefined) fields.seo_title = normalizeWhitespace(input.seoTitle) || null;
  if (input.seoDescription !== undefined) fields.seo_description = normalizeWhitespace(input.seoDescription) || null;
  if (input.sourceUrl !== undefined) {
    const value = normalizeOptionalUrl(input.sourceUrl);
    if (normalizeWhitespace(input.sourceUrl) && !value) throw new Error("A URL da fonte precisa começar com http:// ou https://.");
    fields.source_url = value;
  }
  if (input.coverImageUrl !== undefined) {
    const value = normalizeOptionalUrl(input.coverImageUrl);
    if (normalizeWhitespace(input.coverImageUrl) && !value) throw new Error("A URL da imagem precisa começar com http:// ou https://.");
    fields.cover_image_url = value;
  }
  if (input.status !== undefined) {
    const statusInput = { ...input, status: input.status } as CreateEditorialArticleInput;
    const { status, scheduledAt, publishedAt } = resolveStatus(statusInput);
    fields.status = status;
    fields.scheduled_at = scheduledAt;
    fields.published_at = publishedAt;
  }

  if (!Object.keys(fields).length) throw new Error("Nenhuma alteração foi informada.");
  const query = new URLSearchParams({ id: `eq.${input.id}` });
  const response = await supabaseRequest(`lap_articles?${query.toString()}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(fields),
  });
  const rows = await response.json() as SupabaseArticleRow[];
  if (!rows[0]) throw new Error("Matéria não encontrada.");
  const article = mapArticle(rows[0]);
  await recordVersion(article, "updated");
  return article;
}
