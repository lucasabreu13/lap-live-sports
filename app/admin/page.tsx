import type { Metadata } from "next";
import Link from "next/link";
import { EditorialDesk } from "@/components/editorial-desk";

export const metadata: Metadata = {
  title: "Núcleo editorial | LAP",
  description: "Área de publicação editorial da LAP.",
};

export default function AdminPage() {
  return (
    <main className="admin-page">
      <header className="article-header">
        <div className="shell article-header__inside">
          <Link href="/" className="brand" aria-label="Voltar para a LAP">
            <span className="brand__mark">LAP</span>
            <span className="brand__tag">núcleo editorial</span>
          </Link>
          <div style={{ display: "flex", gap: "14px" }}><Link href="/admin/monitoramento" className="section-link">Monitoramento</Link><Link href="/" className="article-back">← Voltar para a LAP</Link></div>
        </div>
      </header>
      <div className="shell admin-layout">
        <EditorialDesk />
      </div>
    </main>
  );
}
