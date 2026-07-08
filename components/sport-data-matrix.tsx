import Link from "next/link";
import { getAllSportDataBlueprints } from "@/lib/sport-data-blueprints";
import { SPORTS, type SportId } from "@/lib/live-data";
import styles from "./sport-data-matrix.module.css";

function sportMeta(sportId: SportId) {
  return SPORTS.find((sport) => sport.id === sportId);
}

export function SportDataMatrix() {
  const blueprints = getAllSportDataBlueprints();
  return (
    <section className={styles.matrix} aria-labelledby="data-matrix-title">
      <div className={styles.hero}>
        <p>Arquitetura de dados</p>
        <h1 id="data-matrix-title">Grade, eventos e dados fortes por modalidade</h1>
        <span>A LAP agora tem uma matriz clara do que cada esporte exige. Onde é jogo, mostramos grade. Onde é corrida, prova, luta, torneio, bateria ou leaderboard, a interface muda para o formato certo.</span>
      </div>

      <div className={styles.grid}>
        {blueprints.map((blueprint) => {
          const sport = sportMeta(blueprint.sportId);
          return (
            <article className={styles.card} key={blueprint.sportId}>
              <header>
                <span aria-hidden>{sport?.icon ?? "•"}</span>
                <div>
                  <p>{blueprint.eventUnit}</p>
                  <h2>{sport?.name ?? blueprint.sportId}</h2>
                </div>
              </header>
              <dl>
                <div><dt>Superfície principal</dt><dd>{blueprint.primarySurface}</dd></div>
                <div><dt>Ao vivo</dt><dd>{blueprint.liveSurface}</dd></div>
                <div><dt>Participantes</dt><dd>{blueprint.rosterSurface}</dd></div>
                <div><dt>Estatísticas</dt><dd>{blueprint.statsSurface}</dd></div>
              </dl>
              <div className={styles.needs}>
                <p>Dados necessários</p>
                <ul>{blueprint.requiredData.map((item) => <li key={item}>{item.replace(/_/g, " ")}</li>)}</ul>
              </div>
              <div className={styles.providers}>
                <p>Fontes fortes candidatas</p>
                <ul>{blueprint.strongerProviders.map((item) => <li key={item}>{item}</li>)}</ul>
              </div>
              <footer>
                <span>{blueprint.currentFallback}</span>
                <Link href={`/modalidades/${blueprint.sportId}`}>Abrir modalidade →</Link>
              </footer>
            </article>
          );
        })}
      </div>
    </section>
  );
}
