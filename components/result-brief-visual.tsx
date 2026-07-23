import { SPORTS, type SportId } from "@/lib/live-data";
import styles from "./result-brief-visual.module.css";

function sportLabel(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId)?.name || "Esporte";
}

export function ResultBriefVisual({ title, sportId, compact = false }: { title: string; sportId: SportId; compact?: boolean }) {
  return (
    <figure className={`${styles.visual} ${compact ? styles.compact : ""}`} role="img" aria-label={`Resultado rápido: ${title}`}>
      <header className={styles.topline}><span>Resultado rápido</span><small>{sportLabel(sportId)}</small></header>
      <strong>{title}</strong>
      <footer className={styles.footer}><b>LAP</b><span>placar confirmado</span></footer>
    </figure>
  );
}
