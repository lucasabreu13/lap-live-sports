import { runSiteAudit } from "@/lib/site-audit";

async function main() {
  const baseUrl = process.argv[2] || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const deep = process.argv.includes("--deep");
  const report = await runSiteAudit({ baseUrl, deep, maxPerSport: deep ? 12 : 4 });
  const failures = report.items.filter((item) => item.status === "fail");
  const warnings = report.items.filter((item) => item.status === "warn");

  console.log(JSON.stringify({
    ok: report.ok,
    generatedAt: report.generatedAt,
    checked: report.checked,
    okCount: report.okCount,
    warnCount: report.warnCount,
    failCount: report.failCount,
    payload: report.payload,
    failures,
    warnings,
  }, null, 2));

  if (!report.ok) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha ao executar a auditoria do site.");
  process.exitCode = 1;
});
