import type { Metadata } from "next";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { requireAdminSession } from "@/lib/admin-session";
import { getNewsroomArticles } from "@/lib/newsroom-content";

export const metadata: Metadata = {
  title: "Newsroom AI | LAP",
  description: "Monitoramento dos agentes editoriais automatizados da LAP.",
  robots: { index: false, follow: false, nocache: true },
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(date);
}

export default async function NewsroomAdminPage() {
  await requireAdminSession();
  const articles = await getNewsroomArticles(120);
  const agentCounts = Array.from(articles.reduce((map, article) => {
    const agent = article.agentId || "redacao-geral";
    map.set(agent, (map.get(agent) || 0) + 1);
    return map;
  }, new Map<string, number>()).entries()).sort((a, b) => b[1] - a[1]);
  const breaking = articles.filter((article) => article.breaking).length;

  return (
    <main className="admin-page">
      <header className="article-header">
        <div className="shell article-header__inside">
          <Link href="/" className="brand" aria-label="Voltar para a LAP"><span className="brand__mark">LAP</span><span className="brand__tag">Newsroom AI</span></Link>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}><Link href="/admin" className="section-link">Núcleo editorial</Link><Link href="/" className="article-back">← Voltar para a LAP</Link><AdminLogoutButton /></div>
        </div>
      </header>
      <div className="shell admin-layout" style={{ display: "block" }}>
        <section className="editorial-desk__intro">
          <p>Redação autônoma</p>
          <h1>Newsroom AI da LAP</h1>
          <span>Os agentes monitoram fontes públicas, agrupam histórias duplicadas, exigem confirmação em múltiplas fontes e entregam fatos ao Redator-Geral. O texto publicado é original e recebe prioridade editorial para a Home.</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 20 }}>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{articles.length}</strong><span>matérias automatizadas no arquivo atual</span></article>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{agentCounts.length}</strong><span>agentes com conteúdo publicado</span></article>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{breaking}</strong><span>histórias marcadas como urgentes</span></article>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="editorial-library__heading"><div><p>Especialistas</p><h2>Produção por agente</h2></div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 10 }}>
            {agentCounts.length ? agentCounts.map(([agent, count]) => <article className="empty-card" key={agent}><strong>{agent}</strong><span>{count} matéria{count === 1 ? "" : "s"}</span></article>) : <div className="empty-card">A primeira rodada dos agentes ainda não publicou matérias.</div>}
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="editorial-library__heading"><div><p>Últimas publicações</p><h2>Fila publicada pela Newsroom</h2></div><span>{articles.length}</span></div>
          {articles.length ? <div className="article-admin-list">{articles.slice(0, 60).map((article) => <article key={article.id}><div><span className={`status-chip ${article.breaking ? "status-chip--scheduled" : "status-chip--published"}`}>{article.breaking ? "Urgente" : article.agentId || "Newsroom"}</span><h3>{article.title}</h3><p>{formatDate(article.publishedAt)} · prioridade {article.homepagePriority ?? 50}</p></div><div className="article-admin-list__actions"><Link href={`/materias/${article.slug}`}>Abrir</Link></div></article>)}</div> : <div className="empty-card">Nenhuma matéria automática foi publicada ainda. O workflow roda de hora em hora.</div>}
        </section>
      </div>
    </main>
  );
}
