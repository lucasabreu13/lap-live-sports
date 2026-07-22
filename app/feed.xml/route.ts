import { getPublishedEditorialArticles } from "@/lib/editorial-store";
import { getNewsroomArticles } from "@/lib/newsroom-content";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function escapeXml(value: string) { return value.replace(/[<>&'\"]/g, (char) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[char] || char); }

export async function GET() {
  const base = process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app";
  const [editorial, newsroom] = await Promise.all([
    getPublishedEditorialArticles(100).catch(() => []),
    getNewsroomArticles(100).catch(() => []),
  ]);
  const articles = Array.from(new Map([...newsroom, ...editorial].map((article) => [article.slug, article])).values())
    .sort((a, b) => new Date(b.publishedAt || b.createdAt).getTime() - new Date(a.publishedAt || a.createdAt).getTime())
    .slice(0, 50);
  const items = articles.map((article) => `<item><title>${escapeXml(article.title)}</title><link>${base}/materias/${article.slug}</link><guid isPermaLink="true">${base}/materias/${article.slug}</guid><description>${escapeXml(article.summary)}</description><pubDate>${new Date(article.publishedAt || article.createdAt).toUTCString()}</pubDate></item>`).join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>LAP Live Sports</title><link>${base}</link><description>Notícias e histórias do esporte na LAP.</description><language>pt-BR</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, s-maxage=300, stale-while-revalidate=1800" } });
}
