import Image from "next/image";
import { SPORTS, type SportId } from "@/lib/live-data";
import { sportCoverImage } from "@/lib/sport-visuals";
import styles from "./result-brief-visual.module.css";

function sportLabel(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId)?.name || "Esporte";
}

export function ResultBriefVisual({ title, sportId, compact = false }: { title: string; sportId: SportId; compact?: boolean }) {
  const visual = sportCoverImage(sportId);
  return (
    <figure className={`${styles.visual} ${compact ? styles.compact : ""}`} role="img" aria-label={`Resultado rápido: ${title}`}>
      <Image src={visual.image} alt="" fill sizes={compact ? "(max-width: 760px) 110px, 30vw" : "(max-width: 760px) 100vw, 850px"} className={styles.image} />
      <span className={styles.shade} aria-hidden />
      <header className={styles.topline}><span>Resultado rápido</span><small>{sportLabel(sportId)}</small></header>
      <strong>{title}</strong>
      <footer className={styles.footer}><b>LAP</b><span>placar confirmado</span></footer>
    </figure>
  );
}
