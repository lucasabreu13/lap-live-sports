import { refreshRanking, type RefreshedRanking } from "@/lib/ranking-refresh";
import { getRichIndividualHub, type RichIndividualHub, type RichTable } from "@/lib/rich-individual-data";
import type { SportId } from "@/lib/live-data";

function rankingTable(ranking: RefreshedRanking, description: string, limit = 10): RichTable {
  return {
    title: ranking.title,
    description: ranking.isFallback
      ? `${description} A fonte ao vivo não respondeu nesta atualização; exibindo a última versão verificada.`
      : `${description} Atualização automática ativa.`,
    columns: ranking.columns,
    rows: ranking.rows,
    limit,
    sourceLabel: ranking.sourceLabel,
    sourceUrl: ranking.sourceUrl,
    asOf: ranking.asOf,
  };
}

function pointDetail(row: string[] | undefined, index: number) {
  return row?.[index] ? `${row[index]} pontos` : "Ranking em atualização";
}

function uniqueSources(items: string[]) {
  return [...new Set(items.filter(Boolean))];
}

async function refreshTennis(base: RichIndividualHub): Promise<RichIndividualHub> {
  const [atp, wta] = await Promise.all([refreshRanking("atp"), refreshRanking("wta")]);
  const historical = base.tables.filter((table) => !/ATP|WTA/i.test(table.title));
  return {
    ...base,
    subtitle: "Rankings de simples com atualização automática, campeões recentes, Grand Slams e notícias dos principais circuitos.",
    metrics: [
      { label: "Nº 1 ATP", value: atp.rows[0]?.[1] || "—", detail: pointDetail(atp.rows[0], 2) },
      { label: "Nº 1 WTA", value: wta.rows[0]?.[1] || "—", detail: pointDetail(wta.rows[0], 3) },
      { label: "Ranking exibido", value: String(atp.rows.length + wta.rows.length), detail: "Atualização automática + fallback verificado" },
      ...(base.metrics.filter((metric) => metric.label === "Finais recentes").slice(0, 1)),
    ],
    tables: [
      rankingTable(atp, "Classificação atual de simples da ATP."),
      rankingTable(wta, "Classificação atual de simples da WTA."),
      ...historical,
    ],
    sources: uniqueSources([
      "ATP Tour — ranking oficial com atualização automática",
      "WTA Tennis — ranking oficial com atualização automática",
      ...base.sources.filter((source) => !/ATP|WTA/i.test(source)),
    ]),
    generatedAt: new Date().toISOString(),
  };
}

async function refreshGolf(base: RichIndividualHub): Promise<RichIndividualHub> {
  const [owgr, rolex] = await Promise.all([refreshRanking("owgr"), refreshRanking("rolex")]);
  return {
    ...base,
    subtitle: "Rankings mundiais masculino e feminino com atualização automática, torneios recentes, leaderboards e notícias.",
    metrics: [
      { label: "Nº 1 mundial", value: owgr.rows[0]?.[1] || "—", detail: "OWGR masculino" },
      { label: "Nº 1 mundial feminino", value: rolex.rows[0]?.[1] || "—", detail: "Rolex Women's World Golf Rankings" },
      { label: "Ranking exibido", value: String(owgr.rows.length + rolex.rows.length), detail: "Atualização automática + fallback verificado" },
      ...(base.metrics.filter((metric) => metric.label === "Torneios recentes").slice(0, 1)),
    ],
    tables: [
      rankingTable(owgr, "Official World Golf Ranking masculino."),
      rankingTable(rolex, "Ranking mundial feminino oficial Rolex."),
    ],
    sources: uniqueSources([
      "Official World Golf Ranking — widget oficial autoatualizável",
      "Rolex Women's World Golf Rankings — fonte oficial",
      ...base.sources.filter((source) => !/Official World Golf Ranking|Rolex/i.test(source)),
    ]),
    generatedAt: new Date().toISOString(),
  };
}

async function refreshSurf(base: RichIndividualHub): Promise<RichIndividualHub> {
  const [men, women] = await Promise.all([refreshRanking("wslMen"), refreshRanking("wslWomen")]);
  const brazilianStorm = base.tables.find((table) => /Brazilian Storm/i.test(table.title));
  const brazilianTop = [...men.rows, ...women.rows].filter((row) => row[2] === "BRA").length;
  return {
    ...base,
    subtitle: "Ranking do Championship Tour masculino e feminino com atualização automática, Brazilian Storm e notícias da elite mundial.",
    metrics: [
      { label: "Líder masculino", value: men.rows[0]?.[1] || "—", detail: pointDetail(men.rows[0], 3) },
      { label: "Líder feminino", value: women.rows[0]?.[1] || "—", detail: pointDetail(women.rows[0], 3) },
      { label: "Brasileiros no ranking", value: String(brazilianTop), detail: "Entre as posições exibidas nos dois circuitos" },
      ...(base.metrics.filter((metric) => metric.label === "Formato 2026").slice(0, 1)),
    ],
    tables: [
      rankingTable(men, "Classificação do Championship Tour masculino; a WSL segue como fonte canônica.", 10),
      rankingTable(women, "Classificação do Championship Tour feminino; a WSL segue como fonte canônica.", 10),
      ...(brazilianStorm ? [brazilianStorm] : []),
    ],
    sources: uniqueSources([
      "World Surf League — fonte canônica do Championship Tour",
      "Espelho público do ranking consultado automaticamente quando a WSL bloqueia leitura automatizada",
      ...base.sources.filter((source) => !/World Surf League|Snapshot/i.test(source)),
    ]),
    generatedAt: new Date().toISOString(),
  };
}

export async function getRefreshedRichIndividualHub(sportId: SportId): Promise<RichIndividualHub | null> {
  const base = await getRichIndividualHub(sportId);
  if (!base) return null;
  if (sportId === "tenis") return refreshTennis(base);
  if (sportId === "golfe") return refreshGolf(base);
  if (sportId === "surfe") return refreshSurf(base);
  return base;
}
