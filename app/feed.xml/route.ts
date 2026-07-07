import { getPublishedEditorialArticles } from "@/lib/editorial-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeXml(value: string) { return value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char); }

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lap.local";
  const articles = await getPublishedEditorialArticles(30).catch(() => []);
  const items = articles.map((article) => `<item><title>${escapeXml(article.title)}</title><link>${base}/materias/${article.slug}</link><guid isPermaLink="true">${base}/materias/${article.slug}</guid><description>${escapeXml(article.summary)}</description><pubDate>${new Date(article.publishedAt || article.createdAt).toUTCString()}</pubDate></item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>LAP Live Sports</title><link>${base}</link><description>Notícias e histórias do esporte na LAP.</description><language>pt-BR</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "no-store" } });
}
