import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LapHeader } from "@/components/lap-header";
import { decodeArticleTransport, findArticleBySlug, findSportById, type SportId } from "@/lib/live-data";
import { findEditorialArticleBySlug, type EditorialArticle } from "@/lib/editorial-store";
import { getNewsroomArticleBySlug, getNewsroomArticles } from "@/lib/newsroom-content";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./article-reading.module.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app";

type PageProps = { params: Promise<{ slug: string }>; searchParams: Promise<{ d?: string }> };
type BriefArticle = { kind: "brief"; slug: string; sportId: SportId; title: string; excerpt: string; source: string; url: string; publishedAt: string | null; imageUrl: string | null; imageAlt: string | null; };
type ResolvedArticle = { kind: "editorial"; article: EditorialArticle } | { kind: "brief"; article: BriefArticle };
type EditorialWithProvenance = EditorialArticle & { dataDriven?: boolean; sourceUrls?: string[]; provenance?: { provider?: string } };

function formatDate(dateValue: string | null) {
  if (!dateValue) return "Agora";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "Agora";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

function readingTime(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 210));
}

function asBriefArticle(value: ReturnType<typeof decodeArticleTransport> | Awaited<ReturnType<typeof findArticleBySlug>>): BriefArticle | null {
  if (!value || !value.url) return null;
  const visual = sportCoverImage(value.sportId);
  return { kind: "brief", slug: value.slug, sportId: value.sportId, title: value.title, excerpt: value.excerpt, source: value.source, url: value.url, publishedAt: value.publishedAt, imageUrl: value.imageUrl || visual.image, imageAlt: value.imageAlt || visual.alt };
}

async function resolveArticle({ params, searchParams }: PageProps): Promise<ResolvedArticle | null> {
  const { slug } = await params;
  const [editorial, newsroom] = await Promise.all([
    findEditorialArticleBySlug(slug).catch(() => null),
    getNewsroomArticleBySlug(slug).catch(() => null),
  ]);
  if (editorial) return { kind: "editorial", article: editorial };
  if (newsroom) return { kind: "editorial", article: newsroom };
  const { d } = await searchParams;
  const transported = asBriefArticle(decodeArticleTransport(d));
  if (transported?.slug === slug) return { kind: "brief", article: transported };
  const live = asBriefArticle(await findArticleBySlug(slug).catch(() => null));
  return live ? { kind: "brief", article: live } : null;
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const resolved = await resolveArticle(props);
  if (!resolved) return { title: "Matéria não encontrada" };
  if (resolved.kind === "editorial") {
    const article = resolved.article;
    const description = article.seoDescription || article.summary;
    const image = article.coverImageUrl || sportCoverImage(article.sportId as SportId).image;
    return { title: article.seoTitle || article.title, description, alternates: { canonical: `/materias/${article.slug}` }, openGraph: { type: "article", title: article.title, description, url: `/materias/${article.slug}`, images: [{ url: image }] } };
  }
  return { title: resolved.article.title, description: resolved.article.excerpt, alternates: { canonical: `/materias/${resolved.article.slug}` }, openGraph: { type: "article", title: resolved.article.title, description: resolved.article.excerpt, url: `/materias/${resolved.article.slug}`, images: resolved.article.imageUrl ? [{ url: resolved.article.imageUrl }] : undefined } };
}

function EditorialBody({ content }: { content: string }) {
  return <section className="article-body" aria-label="Texto da matéria">{content.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean).map((paragraph, index) => <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>)}</section>;
}

function EditorialSourceCard({ article }: { article: EditorialArticle }) {
  const automated = article.authorRole?.includes("Newsroom AI");
  const enriched = article as EditorialWithProvenance;
  const lapData = Boolean(enriched.dataDriven || article.sourceName === "LAP Dados" || enriched.provenance?.provider === "LAP live-data");
  const copy = lapData
    ? "Texto original da LAP produzido a partir de dados esportivos verificados pela própria plataforma. Informações não confirmadas ficam fora da matéria."
    : automated
      ? "Texto original da LAP produzido a partir de fatos confirmados em fontes externas verificáveis, sem reprodução do conteúdo original."
      : "Conteúdo publicado pelo núcleo editorial da LAP.";
  return <aside className="article-source-card article-source-card--editorial"><p>{automated ? "Apuração" : "Publicação"}</p><strong>{article.sourceName || "LAP"}</strong><span>{copy}</span>{article.sourceUrl && <a href={article.sourceUrl} target="_blank" rel="noreferrer">{lapData ? "Abrir cobertura de dados" : "Ver uma das referências"} <span aria-hidden>↗</span></a>}</aside>;
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
    const visual = sportCoverImage(sport.id);
    const coverImage = article.coverImageUrl || visual.image;
    const related = (await getNewsroomArticles(80)).filter((item) => item.sportId === article.sportId && item.slug !== article.slug).slice(0, 3);
    const articleUrl = `${siteUrl}/materias/${article.slug}`;
    const jsonLd = { "@context": "https://schema.org", "@type": "NewsArticle", headline: article.seoTitle || article.title, description: article.seoDescription || article.summary, mainEntityOfPage: { "@type": "WebPage", "@id": articleUrl }, url: articleUrl, datePublished: article.publishedAt || article.createdAt, dateModified: article.updatedAt, author: { "@type": "Organization", name: article.authorName || "Redação LAP" }, publisher: { "@type": "Organization", name: "LAP", logo: { "@type": "ImageObject", url: `${siteUrl}/icons/lap-icon.svg` } }, image: coverImage };
    return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /><ArticleFrame sportId={sport.id}><header className="article-hero"><p>{sport.icon} {sport.name} • LAP</p><h1>{article.title}</h1><p className="article-dek">{article.summary}</p><div className="article-meta"><span>{article.authorName || "Redação LAP"}</span><span>•</span><time dateTime={article.publishedAt || article.createdAt}>{formatDate(article.publishedAt || article.createdAt)}</time>{article.updatedAt !== article.createdAt && <><span>•</span><span>atualizado</span></>}</div><div className={styles.readingMeta}>{readingTime(article.content)} min de leitura · texto original LAP</div>{article.tags.length > 0 && <div className="article-tags">{article.tags.map((tag: string) => <Link href={`/modalidades/${sport.id}`} key={tag}>#{tag}</Link>)}</div>}</header><img className="article-cover" src={coverImage} alt={article.title || visual.alt} /><div className="article-content"><div><section className={styles.summaryBox}><p>Resumo da notícia</p><h2>O essencial</h2><span>{article.summary}</span></section><EditorialBody content={article.content} /></div><EditorialSourceCard article={article} /></div>{related.length ? <section className={styles.related}><div className={styles.relatedHeader}><div><p>Leia também</p><h2>Mais de {sport.name}</h2></div><Link href={`/modalidades/${sport.id}`}>Ver todas →</Link></div><div className={styles.relatedGrid}>{related.map((item) => <Link key={item.id} href={`/materias/${item.slug}`} className={styles.relatedCard}><img src={item.coverImageUrl || sportCoverImage(item.sportId as SportId).image} alt={item.title} loading="lazy" /><div><small>{sport.name}</small><strong>{item.title}</strong></div></Link>)}</div></section> : null}</ArticleFrame></>;
  }

  const article = resolved.article;
  return <ArticleFrame sportId={sport.id}><header className="article-hero"><p>{sport.icon} {sport.name} • resumo LAP</p><h1>{article.title}</h1><p className="article-dek">{article.excerpt}</p><div className="article-meta"><span>Atualização acompanhada pela LAP</span><span>•</span><time dateTime={article.publishedAt || undefined}>{formatDate(article.publishedAt)}</time></div></header><img className="article-cover" src={article.imageUrl || sportCoverImage(sport.id).image} alt={article.imageAlt || article.title} /><div className="article-content"><><section className="article-summary"><p className="article-eyebrow">LAP em 1 minuto</p><h2>O que você precisa saber</h2><p>{article.excerpt}</p></section><section className="article-context"><h2>Por que isso importa</h2><p>Esta atualização faz parte da cobertura da LAP sobre {sport.name.toLowerCase()}. Acompanhe a página da modalidade para ver jogos, resultados e novos desdobramentos.</p></section></><BriefSourceCard article={article} /></div></ArticleFrame>;
}
