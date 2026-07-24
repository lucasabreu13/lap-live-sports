import type { Metadata } from "next";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { requireAdminSession } from "@/lib/admin-session";
import { getNewsRadar, RADAR_SPORTS, type RadarDecision, type RadarStory } from "@/lib/news-radar";

export const metadata: Metadata = {
  title: "Radar de Notícias | LAP",
  description: "Central de descoberta e triagem de notícias esportivas da LAP.",
  robots: { index: false, follow: false, nocache: true },
};

const decisionLabel: Record<RadarDecision, string> = {
  candidate: "Candidata",
  monitor: "Acompanhar",
  review: "Revisar",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

function editorialSportId(story: RadarStory) {
  return story.sportId === "college-football" ? "futebol-americano" : story.sportId;
}

function deskHref(story: RadarStory) {
  return {
    pathname: "/admin",
    query: {
      radarTitle: story.title,
      radarSport: editorialSportId(story),
      radarSourceName: story.sourceName,
      radarSourceUrl: story.url,
      radarSummary: "Pauta capturada pelo Radar LAP. Confirmar os fatos e redigir um resumo original antes de publicar.",
      radarTags: `${story.sportId}, radar-lap`,
    },
  };
}

export default async function RadarAdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession();
  const params = await searchParams;
  const sport = typeof params.sport === "string" ? params.sport : "all";
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const forceRefresh = params.refresh === "1";
  const radar = await getNewsRadar({ sport, query, forceRefresh, limit: 140 });
  const candidates = radar.stories.filter((story) => story.decision === "candidate").length;
  const rumors = radar.stories.filter((story) => story.isRumor).length;
  const sourceCount = new Set(radar.stories.flatMap((story) => story.corroborationSources)).size;

  return (
    <main className="admin-page">
      <header className="article-header">
        <div className="shell article-header__inside">
          <Link href="/" className="brand" aria-label="Voltar para a LAP"><span className="brand__mark">LAP</span><span className="brand__tag">radar de notícias</span></Link>
          <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
            <Link href="/admin" className="section-link">Núcleo editorial</Link>
            <Link href="/admin/newsroom" className="section-link">Newsroom AI</Link>
            <Link href="/admin/monitoramento" className="section-link">Monitoramento</Link>
            <Link href="/" className="article-back">← LAP</Link>
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <div className="shell admin-layout" style={{ display: "block" }}>
        <section className="editorial-desk__intro">
          <p>Central de pauta</p>
          <h1>Radar LAP</h1>
          <span>Descobre notícias esportivas nas últimas 72 horas, elimina duplicatas, identifica a modalidade, pondera a confiabilidade da fonte e separa fato confirmado de rumor. O Radar nunca publica sozinho: ele entrega a pauta para a Redação LAP.</span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12, marginTop: 20 }}>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{radar.stories.length}</strong><span>pautas relevantes encontradas</span></article>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{candidates}</strong><span>candidatas fortes à publicação</span></article>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{sourceCount}</strong><span>fontes diferentes nesta rodada</span></article>
            <article className="empty-card"><strong style={{ fontSize: 28 }}>{rumors}</strong><span>itens marcados como rumor/mercado</span></article>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <form method="get" style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) minmax(180px,1fr) auto", gap: 10, alignItems: "end" }}>
            <label style={{ display: "grid", gap: 6 }}><span>Pesquisar notícia, clube ou atleta</span><input name="q" defaultValue={query} placeholder="Ex.: Corinthians, Hamilton, Trade Deadline" /></label>
            <label style={{ display: "grid", gap: 6 }}><span>Modalidade</span><select name="sport" defaultValue={sport}><option value="all">Todos os esportes do LAP</option>{RADAR_SPORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <button className="editorial-form__submit" type="submit" style={{ minHeight: 44 }}>Pesquisar</button>
          </form>
          <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link className="section-link" href={{ pathname: "/admin/radar", query: { ...(query ? { q: query } : {}), ...(sport !== "all" ? { sport } : {}), refresh: "1" } }}>Atualizar fontes agora</Link>
            <span style={{ opacity: 0.7, fontSize: 13 }}>Atualização normal em cache de 5 minutos · rodada {formatDate(radar.generatedAt)}</span>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <div className="editorial-library__heading"><div><p>Fontes</p><h2>Conectores do Radar</h2></div></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 10 }}>
            {radar.providers.map((provider) => <article className="empty-card" key={provider.id}><strong>{provider.label}</strong><span>{provider.enabled ? provider.ok ? `Ativo · ${provider.itemCount} retornos` : "Ativo · fonte indisponível nesta rodada" : "Opcional · chave ainda não configurada"}</span><small style={{ opacity: 0.72 }}>{provider.note}</small></article>)}
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <div className="editorial-library__heading"><div><p>Triagem</p><h2>{query ? `Resultados para “${query}”` : sport === "all" ? "Principais pautas esportivas" : `Pautas de ${RADAR_SPORTS.find((item) => item.id === sport)?.label || sport}`}</h2></div><span>{radar.stories.length}</span></div>
          {radar.stories.length ? <div className="article-admin-list">
            {radar.stories.map((story) => (
              <article key={story.id}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                    <span className={`status-chip ${story.decision === "candidate" ? "status-chip--published" : story.decision === "monitor" ? "status-chip--scheduled" : "status-chip--draft"}`}>{decisionLabel[story.decision]} · {story.score}/100</span>
                    <span style={{ fontSize: 12, opacity: 0.75 }}>{story.sportLabel}</span>
                    {story.isRumor && <span style={{ fontSize: 12, fontWeight: 700 }}>RUMOR / MERCADO</span>}
                    {story.corroborationSources.length > 1 && <span style={{ fontSize: 12, fontWeight: 700 }}>{story.corroborationSources.length} fontes</span>}
                  </div>
                  <h3>{story.title}</h3>
                  {story.description && <p style={{ marginTop: 5 }}>{story.description.slice(0, 280)}</p>}
                  <p style={{ marginTop: 7 }}>{story.sourceName} · {formatDate(story.publishedAt)} · via {story.provider}</p>
                </div>
                <div className="article-admin-list__actions" style={{ flexWrap: "wrap" }}>
                  <a href={story.url} target="_blank" rel="noreferrer">Abrir fonte</a>
                  <Link href={deskHref(story)}>Levar para a redação</Link>
                </div>
              </article>
            ))}
          </div> : <div className="empty-card">Nenhuma pauta relevante foi encontrada com esses filtros. O Radar não cria notícias para preencher espaço.</div>}
        </section>
      </div>
    </main>
  );
}
