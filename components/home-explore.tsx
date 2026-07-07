import Link from "next/link";
import { SPORTS } from "@/lib/live-data";

const featuredSportIds = [
  "futebol",
  "futebol-americano",
  "formula1",
  "basquete",
] as const;

export function HomeExplore() {
  const items = featuredSportIds
    .map((id) => SPORTS.find((sport) => sport.id === id))
    .filter((sport): sport is (typeof SPORTS)[number] => Boolean(sport));

  return (
    <section className="home-explore" aria-labelledby="home-explore-title">
      <header className="home-explore__header">
        <div>
          <p>Explore</p>
          <h2 id="home-explore-title">Encontre sua cobertura</h2>
          <span>Abra uma central por modalidade ou consulte toda a agenda.</span>
        </div>

        <Link href="/agenda" className="section-link">
          Abrir agenda
        </Link>
      </header>

      <div className="home-explore__grid">
        {items.map((sport) => (
          <Link
            key={sport.id}
            href={`/modalidades/${sport.id}`}
            className="home-explore__card"
          >
            <span aria-hidden="true">{sport.icon}</span>
            <strong>{sport.name}</strong>
            <small>{sport.description || "Noticias, jogos e resultados."}</small>
            <em>Ver central {"\u2192"}</em>
          </Link>
        ))}
      </div>
    </section>
  );
}