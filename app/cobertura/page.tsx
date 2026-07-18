import type { Metadata } from "next";
import { LapHeader } from "@/components/lap-header";
import { SportDataMatrix } from "@/components/sport-data-matrix";

export const metadata: Metadata = {
  title: "Mapa de cobertura | LAP",
  description: "Veja como a LAP organiza jogos, etapas, torneios, corridas, lutas e provas em cada modalidade.",
};

export default function CoveragePage() {
  return (
    <main>
      <LapHeader />
      <div className="shell page">
        <SportDataMatrix />
      </div>
    </main>
  );
}
