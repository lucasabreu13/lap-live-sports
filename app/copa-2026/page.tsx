import type { Metadata } from "next";
import { WorldCupHub } from "@/components/live-hubs";

export const metadata: Metadata = {
  title: "Copa do Mundo 2026 — Arquivo",
  description: "Especial pós-Copa da LAP: Espanha campeã mundial de 2026, final contra a Argentina e arquivo de resultados do torneio.",
};

export default function WorldCupPage() { return <WorldCupHub />; }
