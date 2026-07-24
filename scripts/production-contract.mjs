const baseUrl = (process.argv[2] || process.env.LAP_PRODUCTION_URL || "https://lap-live-sports.vercel.app").replace(/\/$/, "");

const HIDDEN_SPORT_PATHS = ["softball", "volei", "rugby", "criquete", "mma", "natacao", "atletismo"].map((id) => `/modalidades/${id}`);
const STALE_COPY = [
  "Portal LAP",
  "Copa do Mundo 2026 em destaque na LAP",
  "Acompanhe os confrontos ao vivo, todos os resultados e a agenda da fase decisiva",
  "Carregando a redação multimodalidade",
  "Atualização pendente Horário local --:--:--",
  "Conectando ao radar",
  "0 evento s",
];

async function fetchText(path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": "LAP Production Contract/1.1",
        "cache-control": "no-cache",
        pragma: "no-cache",
      },
    });
    const text = await response.text();
    return { path, status: response.status, ok: response.ok, text };
  } finally {
    clearTimeout(timer);
  }
}

function titleOf(html) {
  return html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || "";
}

function checkPage(result) {
  const issues = [];
  if (!result.ok) issues.push(`${result.path}: HTTP ${result.status}`);
  const title = titleOf(result.text);
  if (/\|\s*LAP\s*\|\s*LAP/i.test(title)) issues.push(`${result.path}: título duplicado (${title})`);
  for (const stale of STALE_COPY) if (result.text.includes(stale)) issues.push(`${result.path}: conteúdo antigo/placeholder detectado (${stale})`);
  return issues;
}

function hasShellMeta(html, shell) {
  if (!shell) return false;
  const escaped = shell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+name=["']lap-shell["'][^>]+content=["']${escaped}["']`, "i"),
    new RegExp(`<meta[^>]+content=["']${escaped}["'][^>]+name=["']lap-shell["']`, "i"),
  ];
  return patterns.some((pattern) => pattern.test(html));
}

async function main() {
  const [home, agenda, live, cup, version] = await Promise.all([
    fetchText("/"),
    fetchText("/agenda"),
    fetchText("/ao-vivo"),
    fetchText("/copa-2026"),
    fetchText("/api/version"),
  ]);

  const issues = [...checkPage(home), ...checkPage(agenda), ...checkPage(live), ...checkPage(cup)];

  let versionPayload = null;
  try { versionPayload = JSON.parse(version.text); } catch { issues.push("/api/version: resposta não é JSON válido"); }
  if (!version.ok) issues.push(`/api/version: HTTP ${version.status}`);

  const deployedShell = typeof versionPayload?.shell === "string" ? versionPayload.shell.trim() : "";
  if (!/^editorial-v\d+(?:-[a-z0-9-]+)?$/i.test(deployedShell)) issues.push(`/api/version: shell inesperado (${deployedShell || "ausente"})`);
  if (deployedShell && !hasShellMeta(home.text, deployedShell)) issues.push(`/: marcador lap-shell ${deployedShell} ausente ou divergente da API de versão`);
  if (versionPayload?.environment && versionPayload.environment !== "production") issues.push(`/api/version: ambiente não é production (${versionPayload.environment})`);

  for (const hiddenPath of HIDDEN_SPORT_PATHS) if (home.text.includes(`href="${hiddenPath}"`)) issues.push(`/: modalidade oculta ainda exposta (${hiddenPath})`);
  if (!/Espanha/i.test(cup.text) || !/campe[aã]/i.test(cup.text)) issues.push("/copa-2026: especial pós-Copa não deixa Espanha campeã identificável no HTML");

  const report = {
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    baseUrl,
    version: versionPayload,
    pages: [home, agenda, live, cup].map(({ path, status, text }) => ({ path, status, title: titleOf(text) })),
    issues,
  };
  console.log(JSON.stringify(report, null, 2));
  if (issues.length) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }, null, 2));
  process.exitCode = 1;
});
