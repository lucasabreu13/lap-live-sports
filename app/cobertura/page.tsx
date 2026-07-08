import type { Metadata } from "next";
import { LapHeader } from "@/components/lap-header";
import { SportDataMatrix } from "@/components/sport-data-matrix";

export const metadata: Metadata = {
  title: "Cobertura de dados | LAP",
  description: "Matriz de dados da LAP por modalidade: grade de jogos, calendário, leaderboard, timeline, escalações e fontes fortes candidatas.",
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
