import type { Metadata } from "next";
import { WorldCupHub } from "@/components/live-hubs";
export const metadata: Metadata = { title: "Copa do Mundo 2026 | LAP", description: "Central da Copa do Mundo 2026: partidas, resultados, chaveamento e Seleção Brasileira." };
export default function WorldCupPage() { return <WorldCupHub />; }
