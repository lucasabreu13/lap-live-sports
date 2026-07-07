"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { SPORTS } from "@/lib/live-data";
import type { EditorialArticle, EditorialArticleStatus, EditorialRole } from "@/lib/editorial-store";

type SaveState = { type: "idle" | "saving" | "success" | "error"; message?: string; slug?: string };
const statuses: Array<{ value: EditorialArticleStatus; label: string }> = [
  { value: "draft", label: "Rascunho" }, { value: "in_review", label: "Em revisão" }, { value: "scheduled", label: "Agendar" }, { value: "published", label: "Publicar" }, { value: "archived", label: "Arquivar" },
];

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditorialDesk() {
  const [token, setToken] = useState("");
  const [role, setRole] = useState<EditorialRole | null>(null);
  const [articles, setArticles] = useState<EditorialArticle[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [sportId, setSportId] = useState("futebol");
  const [authorName, setAuthorName] = useState("LAP");
  const [tags, setTags] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [articleStatus, setArticleStatus] = useState<EditorialArticleStatus>("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [status, setStatus] = useState<SaveState>({ type: "idle" });
  const canSave = useMemo(() => Boolean(token && title.trim() && summary.trim() && content.trim()), [content, summary, title, token]);
  const permittedStatuses = statuses.filter((item) => role === "admin" || (role === "editor" && item.value !== "archived") || (role === "writer" && (item.value === "draft" || item.value === "in_review")) || !role);

  function resetForm() {
    setEditingId(null); setTitle(""); setSummary(""); setContent(""); setSportId("futebol"); setAuthorName("LAP"); setTags(""); setSourceName(""); setSourceUrl(""); setCoverImageUrl(""); setSeoTitle(""); setSeoDescription(""); setArticleStatus("draft"); setScheduledAt("");
  }

  async function loadDesk() {
    setStatus({ type: "saving", message: "Carregando painel…" });
    try {
      const response = await fetch("/api/editorial/articles", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      const payload = await response.json() as { role?: EditorialRole; articles?: EditorialArticle[]; error?: string };
      if (!response.ok || !payload.role) throw new Error(payload.error || "Não foi possível abrir o painel editorial.");
      setRole(payload.role); setArticles(payload.articles || []); setStatus({ type: "success", message: `Perfil ${payload.role} conectado.` });
    } catch (error) { setStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível abrir o painel." }); }
  }

  function editArticle(article: EditorialArticle) {
    setEditingId(article.id); setTitle(article.title); setSummary(article.summary); setContent(article.content); setSportId(article.sportId); setAuthorName(article.authorName || "LAP"); setTags(article.tags.join(", ")); setSourceName(article.sourceName || ""); setSourceUrl(article.sourceUrl || ""); setCoverImageUrl(article.coverImageUrl || ""); setSeoTitle(article.seoTitle || ""); setSeoDescription(article.seoDescription || ""); setArticleStatus(article.status); setScheduledAt(toLocalInput(article.scheduledAt)); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus({ type: "saving" });
    const body = { title, summary, content, sportId, authorName, authorRole: role ? `Perfil ${role}` : "Redação LAP", tags, sourceName, sourceUrl, coverImageUrl, seoTitle, seoDescription, status: articleStatus, scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null };
    try {
      const response = await fetch("/api/editorial/articles", { method: editingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(editingId ? { id: editingId, ...body } : body) });
      const payload = await response.json() as { article?: EditorialArticle; error?: string };
      if (!response.ok || !payload.article) throw new Error(payload.error || "Não foi possível salvar a matéria.");
      setArticles((current) => [payload.article!, ...current.filter((article) => article.id !== payload.article!.id)]);
      setStatus({ type: "success", message: editingId ? "Matéria atualizada na LAP." : "Matéria salva na LAP.", slug: payload.article.slug });
      resetForm();
    } catch (error) { setStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível salvar a matéria." }); }
  }

  async function quickStatus(article: EditorialArticle, next: EditorialArticleStatus) {
    setStatus({ type: "saving" });
    try {
      const response = await fetch("/api/editorial/articles", { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: article.id, status: next }) });
      const payload = await response.json() as { article?: EditorialArticle; error?: string };
      if (!response.ok || !payload.article) throw new Error(payload.error || "Não foi possível atualizar.");
      setArticles((current) => current.map((item) => item.id === payload.article!.id ? payload.article! : item));
      setStatus({ type: "success", message: "Status atualizado." });
    } catch (error) { setStatus({ type: "error", message: error instanceof Error ? error.message : "Não foi possível atualizar." }); }
  }

  return <section className="editorial-desk"><div className="editorial-desk__intro"><p>Núcleo editorial</p><h1>Redação da LAP</h1><span>Crie, revise, agende e publique conteúdo próprio ou conteúdo com direitos de publicação. O token fica somente nesta sessão do navegador.</span><div className="editorial-login"><input type="password" value={token} onChange={(event) => setToken(event.target.value)} autoComplete="off" placeholder="Token editorial" /><button type="button" onClick={() => void loadDesk()} disabled={!token || status.type === "saving"}>{role ? `Conectado: ${role}` : "Abrir painel"}</button></div></div>
  <div className="editorial-workspace"><form className="editorial-form" onSubmit={onSubmit}><div className="editorial-form__heading"><div><p>{editingId ? "Edição" : "Nova matéria"}</p><h2>{editingId ? "Atualizar conteúdo" : "Criar conteúdo"}</h2></div>{editingId && <button type="button" className="form-quiet-button" onClick={resetForm}>Cancelar edição</button>}</div><label>Título<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Título da matéria" required minLength={8} /></label><label>Resumo<textarea value={summary} onChange={(event) => setSummary(event.target.value)} placeholder="Resumo para home, redes e buscadores" required minLength={20} rows={3} /></label><div className="editorial-form__pair"><label>Modalidade<select value={sportId} onChange={(event) => setSportId(event.target.value)}>{SPORTS.map((sport) => <option key={sport.id} value={sport.id}>{sport.icon} {sport.name}</option>)}</select></label><label>Status<select value={articleStatus} onChange={(event) => setArticleStatus(event.target.value as EditorialArticleStatus)}>{permittedStatuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>{articleStatus === "scheduled" && <label>Publicar em<input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label>}<label>Texto da matéria<textarea value={content} onChange={(event) => setContent(event.target.value)} placeholder="Use parágrafos separados por uma linha em branco." required minLength={80} rows={14} /></label><div className="editorial-form__pair"><label>Autor<input value={authorName} onChange={(event) => setAuthorName(event.target.value)} placeholder="Nome do autor" /></label><label>Tags<input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="copa, brasil, seleção" /></label></div><div className="editorial-form__pair"><label>Fonte ou crédito<input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="LAP ou veículo parceiro" /></label><label>URL de referência<input type="url" value={sourceUrl} onChange={(event) => setSourceUrl(event.target.value)} placeholder="https://" /></label></div><label>Imagem de capa<input type="url" value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://imagem-autorizada.jpg" /></label><div className="editorial-form__pair"><label>Título SEO<input value={seoTitle} onChange={(event) => setSeoTitle(event.target.value)} placeholder="Opcional — até 60 caracteres" /></label><label>Descrição SEO<input value={seoDescription} onChange={(event) => setSeoDescription(event.target.value)} placeholder="Opcional — até 160 caracteres" /></label></div><button className="editorial-form__submit" type="submit" disabled={!canSave || status.type === "saving"}>{status.type === "saving" ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar matéria"}</button>{status.type !== "idle" && <p className={`editorial-message editorial-message--${status.type}`}>{status.message}{status.slug && <> <Link href={`/materias/${status.slug}`}>Ver na LAP →</Link></>}</p>}</form>
  <aside className="editorial-library"><div className="editorial-library__heading"><div><p>Biblioteca</p><h2>Conteúdos recentes</h2></div><span>{articles.length}</span></div>{articles.length ? <div className="article-admin-list">{articles.map((article) => <article key={article.id}><div><span className={`status-chip status-chip--${article.status}`}>{statuses.find((item) => item.value === article.status)?.label || article.status}</span><h3>{article.title}</h3><p>{article.authorName || "LAP"} · {article.sportId}</p></div><div className="article-admin-list__actions"><button type="button" onClick={() => editArticle(article)}>Editar</button>{role !== "writer" && article.status !== "published" && <button type="button" onClick={() => void quickStatus(article, "published")}>Publicar</button>}{role === "admin" && article.status !== "archived" && <button type="button" onClick={() => void quickStatus(article, "archived")}>Arquivar</button>}</div></article>)}</div> : <p className="editorial-library__empty">Conecte o painel para ver rascunhos, agendamentos e publicações.</p>}</aside></div></section>;
}
