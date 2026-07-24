import type { Metadata } from "next";
import Link from "next/link";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { EditorialDesk } from "@/components/editorial-desk";
import { requireAdminSession } from "@/lib/admin-session";

export const metadata: Metadata = {
  title: "Núcleo editorial | LAP",
  description: "Área de publicação editorial da LAP.",
  robots: { index: false, follow: false, nocache: true },
};

function value(params: Record<string, string | string[] | undefined>, key: string) {
  return typeof params[key] === "string" ? params[key] as string : "";
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdminSession();
  const params = await searchParams;
  const radarSourceUrl = value(params, "radarSourceUrl");
  const initialDraft = radarSourceUrl ? {
    title: value(params, "radarTitle"),
    summary: value(params, "radarSummary"),
    sportId: value(params, "radarSport") || "futebol",
    tags: value(params, "radarTags"),
    sourceName: value(params, "radarSourceName"),
    sourceUrl: radarSourceUrl,
  } : undefined;

  return (
    <main className="admin-page">
      <header className="article-header">
        <div className="shell article-header__inside">
          <Link href="/" className="brand" aria-label="Voltar para a LAP">
            <span className="brand__mark">LAP</span>
            <span className="brand__tag">núcleo editorial</span>
          </Link>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}><Link href="/admin/radar" className="section-link">Radar LAP</Link><Link href="/admin/newsroom" className="section-link">Newsroom AI</Link><Link href="/admin/monitoramento" className="section-link">Monitoramento</Link><Link href="/" className="article-back">← Voltar para a LAP</Link><AdminLogoutButton /></div>
        </div>
      </header>
      <div className="shell admin-layout">
        <EditorialDesk initialDraft={initialDraft} />
      </div>
    </main>
  );
}
