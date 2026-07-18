import Link from "next/link";
import { getAllSportDataBlueprints } from "@/lib/sport-data-blueprints";
import { SPORTS, type SportId } from "@/lib/live-data";
import styles from "./sport-data-matrix.module.css";

function sportMeta(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId);
}

function availability(sportId: SportId) {
  const sport = sportMeta(sportId);
  return sport?.espnPath
    ? "Agenda, resultados e notícias quando publicados"
    : "Notícias, guia e mapa da modalidade disponíveis";
}

export function SportDataMatrix() {
  const blueprints = getAllSportDataBlueprints();
  return (
    <section className={styles.matrix} aria-labelledby="coverage-map-title">
      <div className={styles.hero}>
        <p>Cobertura LAP</p>
        <h1 id="coverage-map-title">Cada esporte, no formato certo</h1>
        <span>Jogos para esportes de equipe, etapas para circuitos, sessões para corridas, cards para lutas e provas para modalidades de tempo ou marca.</span>
      </div>

      <div className={styles.grid}>
        {blueprints.map((blueprint) => {
          const sport = sportMeta(blueprint.sportId);
          return (
            <article className={styles.card} key={blueprint.sportId}>
              <header>
                <span aria-hidden>{sport?.icon ?? "•"}</span>
                <div><p>{blueprint.eventUnit}</p><h2>{sport?.name ?? blueprint.sportId}</h2></div>
              </header>
              <dl>
                <div><dt>Visão principal</dt><dd>{blueprint.primarySurface}</dd></div>
                <div><dt>Durante o evento</dt><dd>{blueprint.liveSurface}</dd></div>
                <div><dt>Participantes</dt><dd>{blueprint.rosterSurface}</dd></div>
                <div><dt>Números importantes</dt><dd>{blueprint.statsSurface}</dd></div>
              </dl>
              <footer><span>{availability(blueprint.sportId)}</span><Link href={`/modalidades/${blueprint.sportId}`}>Abrir modalidade</Link></footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
