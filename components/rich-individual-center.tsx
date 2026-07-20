import Link from "next/link";
import { LapHeader } from "@/components/lap-header";
import type { RichIndividualHub, RichTable } from "@/lib/rich-individual-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./rich-individual-center.module.css";

function RichDataTable({ table }: { table: RichTable }) {
  const rows = table.limit ? table.rows.slice(0, table.limit) : table.rows;
  return <section className={styles.tablePanel}><header><div><span>Dados</span><h2>{table.title}</h2><p>{table.description}</p></div><strong>{rows.length}</strong></header>
    {rows.length ? <div className={styles.tableWrap}><table><thead><tr>{table.columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`${table.title}-${rowIndex}`}>{table.columns.map((_, index) => <td key={index}>{row[index] || "—"}</td>)}</tr>)}</tbody></table></div> : <div className={styles.empty}>A fonte pública não retornou uma tabela confiável para este bloco agora.</div>}
  </section>;
}

export function RichIndividualCenter({ hub }: { hub: RichIndividualHub }) {
  const visual = sportCoverImage(hub.sportId);
  return <main><LapHeader activeSport={hub.sportId} compact /><div className={`shell ${styles.page}`}>
    <nav className="article-breadcrumb"><Link href="/">Início</Link><span>›</span><span>{hub.eyebrow}</span></nav>
    <section className={styles.hero}><img src={visual.image} alt={visual.alt} /><div><span>{hub.eyebrow}</span><h1>{hub.title}</h1><p>{hub.subtitle}</p></div></section>

    <section className={styles.metrics}>{hub.metrics.map((metric) => <article key={`${metric.label}-${metric.value}`}><span>{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}</section>

    {hub.spotlights.length ? <section className={styles.spotlightGrid}>{hub.spotlights.map((item) => <article key={item.title}><span>{item.eyebrow}</span><h2>{item.title}</h2>{item.value ? <strong>{item.value}</strong> : null}<p>{item.text}</p></article>)}</section> : null}

    <div className={styles.tables}>{hub.tables.map((table) => <RichDataTable key={table.title} table={table} />)}</div>

    {hub.results.length ? <section className={styles.section}><header className={styles.sectionHead}><div><span>Resultados</span><h2>Últimos eventos e vencedores</h2><p>Resultados reais retornados pelas fontes da modalidade.</p></div></header><div className={styles.results}>{hub.results.map((result, index) => <article key={`${result.title}-${index}`}><header><div><span>{result.subtitle}</span><h3>{result.title}</h3></div><small>{result.date || "Data não publicada"}</small></header><div>{result.rows.map((row, rowIndex) => <p key={`${row.label}-${rowIndex}`}><strong>{row.label}</strong><span>{row.value}</span>{row.detail ? <small>{row.detail}</small> : null}</p>)}</div></article>)}</div></section> : null}

    <section className={styles.section}><header className={styles.sectionHead}><div><span>Notícias</span><h2>Últimas histórias</h2><p>Atualizações editoriais e notícias relacionadas à modalidade.</p></div></header>{hub.news.length ? <div className={styles.news}>{hub.news.map((item) => <Link key={item.id} href={item.internalUrl}><img src={item.imageUrl || visual.image} alt={item.imageAlt || visual.alt} loading="lazy" /><span>{item.source}</span><strong>{item.title}</strong><small>{item.excerpt}</small></Link>)}</div> : <div className={styles.empty}>As próximas notícias aparecem aqui assim que forem publicadas.</div>}</section>

    <section className={styles.sources}><span>Fontes usadas nesta central</span><div>{hub.sources.map((source) => <p key={source}>{source}</p>)}</div><small>Campos que não chegam de forma confiável ficam vazios. A LAP não cria ranking, salário, resultado ou estatística por estimativa.</small></section>
  </div></main>;
}
