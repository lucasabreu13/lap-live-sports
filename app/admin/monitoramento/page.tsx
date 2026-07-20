import type { Metadata } from "next";
import { MonitoringPanel } from "@/components/monitoring-panel";
import { requireAdminSession } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Monitoramento | LAP",
  description: "Saúde das fontes e do calendário ao vivo da LAP.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function MonitoringPage() {
  await requireAdminSession();
  return <MonitoringPanel />;
}
