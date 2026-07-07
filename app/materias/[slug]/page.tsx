import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LapHeader } from "@/components/lap-header";
import { decodeArticleTransport, findArticleBySlug, findSportById, type SportId } from "@/lib/live-data";
import { findEditorialArticleBySlug, type EditorialArticle } from "@/lib/editorial-store";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ d?: string }> };
type BriefArticle = { kind: "brief"; slug: string; sportId: SportId; title: string; excerpt: string; source: string; url: string; publishedAt: string | null; };
type ResolvedArticle = { kind: "editorial"; article: EditorialArticle } | { kind: "brief"; article: BriefArticle };

function formatDate(dateValue: string | null) {
  if (!dateValue) return "Agora";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function asBriefArticle(value: ReturnType<typeof decodeArticleTransport> | Awaited<ReturnType<typeof findArticleBySlug>>): BriefArticle | null {
  if (!value || !value.url) return null;
  return { kind: "brief", slug: value.slug, sportId: value.sportId, title: value.title, excerpt: value.excerpt, source: value.source, url: value.url, publishedAt: value.publishedAt };
}

async function resolveArticle({ params, searchParams }: PageProps): Promise<ResolvedArticle | null> {
  const { slug } = await params;
  const editorial = await findEditorialArticleBySlug(slug).catch(() => null);
  if (editorial) return { kind: "editorial", article: editorial };
  const { d } = await searchParams;
  const transported = asBriefArticle(decodeArticleTransport(d));
  if (transported?.slug === slug) return { kind: "brief", article: transported };
  const live = asBriefArticle(await findArticleBySlug(slug).catch(() => null));
  return live ? { kind: "brief", article: live } : null;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const resolved = await resolveArticle(props);
  if (!resolved) return { title: "Matéria não encontrada | LAP" };
  if (resolved.kind === "editorial") {
    const article = resolved.article;
    const description = article.seoDescription || article.summary;
    return { title: article.seoTitle || article.title, description, openGraph: { type: "article", title: article.title, description, images: article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined } };
  }
  return { title: resolved.article.title, description: resolved.article.excerpt };
}

function EditorialBody({ content }: { content: string }) {
  return <section className="article-body" aria-label="Texto da matéria">{content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}</section>;
}

function EditorialSourceCard({ article }: { article: EditorialArticle }) {
  return <aside className="article-source-card article-source-card--editorial"><p>Publicação</p><strong>{article.sourceName || "LAP"}</strong><span>Conteúdo publicado pelo núcleo editorial da LAP.</span>{article.sourceUrl && <a href={article.sourceUrl} target="_blank" rel="noreferrer">Ver referência <span aria-hidden>↗</span></a>}</aside>;
}

function BriefSourceCard({ article }: { article: BriefArticle }) {
  return <aside className="article-source-card"><p>Fonte da reportagem</p><strong>{article.source}</strong><span>A LAP resume os pontos principais e mantém a referência à publicação original.</span><a href={article.url} target="_blank" rel="noreferrer">Ver referência <span aria-hidden>↗</span></a></aside>;
}

function ArticleFrame({ sportId, children }: { sportId: SportId; children: React.ReactNode }) {
  const sport = findSportById(sportId);
  return <main className="article-page"><LapHeader activeSport={sport.id} /><article className="shell article-layout"><nav className="article-breadcrumb" aria-label="Navegação estrutural"><Link href="/">Início</Link><span>›</span><Link href={`/modalidades/${sport.id}`}>{sport.name}</Link></nav>{children}</article><section className="article-next"><div className="shell article-next__inside"><div><p>Continue na LAP</p><h2>Mais jogos e histórias para acompanhar.</h2></div><Link href={`/modalidades/${sport.id}`} className="article-next__button">Ver {sport.name} na LAP →</Link></div></section></main>;
}

export default async function ArticlePage(props: PageProps) {
  const resolved = await resolveArticle(props);
  if (!resolved) notFound();
  const sport = findSportById(resolved.article.sportId as SportId);

  if (resolved.kind === "editorial") {
    const article = resolved.article;
    const jsonLd = { "@context": "https://schema.org", "@type": "NewsArticle", headline: article.seoTitle || article.title, description: article.seoDescription || article.summary, datePublished: article.publishedAt || article.createdAt, dateModified: article.updatedAt, author: { "@type": "Person", name: article.authorName || "LAP" }, publisher: { "@type": "Organization", name: "LAP" }, image: article.coverImageUrl || undefined };
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><ArticleFrame sportId={sport.id}><header className="article-hero"><p>{sport.icon} {sport.name} • LAP</p><h1>{article.title}</h1><p className="article-dek">{article.summary}</p><div className="article-meta"><span>{article.authorName || "Redação LAP"}</span><span>•</span><time dateTime={article.publishedAt || article.createdAt}>{formatDate(article.publishedAt || article.createdAt)}</time>{article.updatedAt !== article.createdAt && <><span>•</span><span>atualizado</span></>}</div>{article.tags.length > 0 && <div className="article-tags">{article.tags.map((tag: string) => <Link href={`/modalidades/${sport.id}`} key={tag}>#{tag}</Link>)}</div>}</header>{article.coverImageUrl && <img className="article-cover" src={article.coverImageUrl} alt="" />}<div className="article-content"><EditorialBody content={article.content} /><EditorialSourceCard article={article} /></div></ArticleFrame></>;
  }

  const article = resolved.article;
  return <ArticleFrame sportId={sport.id}><header className="article-hero"><p>{sport.icon} {sport.name} • resumo LAP</p><h1>{article.title}</h1><p className="article-dek">{article.excerpt}</p><div className="article-meta"><span>Atualização acompanhada pela LAP</span><span>•</span><time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time></div></header><div className="article-content"><><section className="article-summary"><p className="article-eyebrow">LAP em 1 minuto</p><h2>O que você precisa saber</h2><p>{article.excerpt}</p></section><section className="article-context"><h2>Por que isso importa</h2><p>Esta atualização faz parte da cobertura da LAP sobre {sport.name.toLowerCase()}. Acompanhe a página da modalidade para ver jogos, resultados e novos desdobramentos.</p></section></><BriefSourceCard article={article} /></div></ArticleFrame>;
}
