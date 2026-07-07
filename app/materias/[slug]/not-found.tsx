import Link from "next/link";

export default function ArticleNotFound() {
  return (
    <main className="article-page article-page--not-found">
      <div className="shell not-found-card">
        <p>LAP</p>
        <h1>Esta matéria não está disponível.</h1>
        <span>Volte para a cobertura ao vivo e encontre as últimas atualizações.</span>
        <Link href="/">Ir para a home da LAP →</Link>
      </div>
    </main>
  );
}
