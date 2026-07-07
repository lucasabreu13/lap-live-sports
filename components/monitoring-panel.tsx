"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Health = { status: "operational" | "degraded" | "unavailable"; generatedAt?: string; refreshSeconds?: number; worldCup?: "ok" | "unavailable"; feeds?: number; feedsWithNews?: number; feedsWithScores?: number; scoreSources?: number; liveFeeds?: number; staleFeeds?: number; footballCompetitions?: number; };

function label(status: Health["status"]) { return status === "operational" ? "Operacional" : status === "degraded" ? "Atenção" : "Indisponível"; }

export function MonitoringPanel() {
  const [health, setHealth] = useState<Health | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      setHealth(await response.json() as Health);
      setCheckedAt(new Date().toISOString());
    } catch { setHealth({ status: "unavailable" }); setCheckedAt(new Date().toISOString()); }
  }, []);

  useEffect(() => { void check(); const timer = window.setInterval(() => void check(), 30_000); return () => window.clearInterval(timer); }, [check]);
  const time = checkedAt ? new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(checkedAt)) : "—";

  return <main className="admin-page"><header className="article-header"><div className="shell article-header__inside"><Link href="/admin" className="brand"><span className="brand__mark">LAP</span><span className="brand__tag">monitoramento</span></Link><Link href="/" className="section-link">Voltar para a LAP</Link></div></header><div className="shell admin-layout"><section className="monitoring"><div className="monitoring__hero"><p>Observabilidade</p><h1>Saúde das fontes</h1><span>A LAP verifica as fontes e o calendário automaticamente. Última checagem: {time}.</span><button className="refresh-button" onClick={() => void check()}>Atualizar agora</button></div><div className="monitoring__grid"><article><span>Status geral</span><strong className={`monitoring__status monitoring__status--${health?.status || "unavailable"}`}>{label(health?.status || "unavailable")}</strong></article><article><span>Modalidades</span><strong>{health?.feeds ?? "—"}</strong><small>coberturas consultadas</small></article><article><span>Notícias disponíveis</span><strong>{health?.feedsWithNews ?? "—"}</strong><small>modalidades com retorno</small></article><article><span>Agenda disponível</span><strong>{health?.feedsWithScores ?? "—"}</strong><small>modalidades com eventos</small></article><article><span>Feeds ao vivo</span><strong>{health?.liveFeeds ?? "—"}</strong><small>{health?.staleFeeds ? `${health.staleFeeds} em cache resiliente` : "sem cache pendente"}</small></article><article><span>Futebol mundial</span><strong>{health?.footballCompetitions ?? "—"}</strong><small>ligas mapeadas na central</small></article><article><span>Fonte da Copa</span><strong>{health?.worldCup === "ok" ? "OK" : health?.worldCup === "unavailable" ? "—" : "—"}</strong><small>calendário da competição</small></article><article><span>Atualização de segurança</span><strong>{health?.refreshSeconds ? `${health.refreshSeconds}s` : "—"}</strong><small>fallback do cliente</small></article></div><section className="monitoring__notes"><h2>Como interpretar</h2><p>“Atenção” indica que alguma fonte está em reconexão. A LAP preserva a última resposta válida por até 20 minutos, mantém o CMS disponível e tenta novamente no próximo ciclo. Eventos enviados pelo webhook são distribuídos imediatamente pelo canal ao vivo.</p></section></section></div></main>;
}
