import editorial from "@/content/college-football/editorial.json";
import styles from "./college-football-editorial-strip.module.css";

export function CollegeFootballEditorialStrip() {
  return (
    <section className={styles.strip} aria-label="Atualizações editoriais de College Football">
      <div className={`shell ${styles.inside}`}>
        <div className={styles.intro}>
          <span>Atualização verificada · 23 jul</span>
          <strong>College Football agora</strong>
        </div>
        <div className={styles.grid}>
          {editorial.map((item) => (
            <article className={styles.card} key={item.id}>
              <div className={styles.meta}><b>{item.label}</b><span>{item.updatedAt}</span></div>
              <h2>{item.title}</h2>
              <p>{item.summary}</p>
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">Fonte: {item.sourceName} ↗</a>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
