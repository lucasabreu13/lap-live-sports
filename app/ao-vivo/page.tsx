import type { Metadata } from "next";
import { LiveScoresHub } from "@/components/live-scores-hub";

export const metadata: Metadata = {
  title: "Ao Vivo | LAP",
  description: "Central ao vivo da LAP com jogos em andamento, agenda de hoje, próximos eventos e resultados verificados.",
};

export default function LivePage() {
  return <LiveScoresHub />;
}
