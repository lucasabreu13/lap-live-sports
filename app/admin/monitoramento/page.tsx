import type { Metadata } from "next";
import { MonitoringPanel } from "@/components/monitoring-panel";
export const metadata: Metadata = { title: "Monitoramento | LAP", description: "Saúde das fontes e do calendário ao vivo da LAP." };
export default function MonitoringPage() { return <MonitoringPanel />; }
