import { NextResponse } from "next/server";
import { runSiteAudit } from "@/lib/site-audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 300;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const maxPerSport = Number.parseInt(url.searchParams.get("maxPerSport") || "4", 10);
  try {
    const report = await runSiteAudit({ baseUrl: url.origin, deep, maxPerSport: Number.isFinite(maxPerSport) ? maxPerSport : 4 });
    return NextResponse.json(report, { status: report.ok ? 200 : 207, headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao executar auditoria do site.";
    return NextResponse.json({ ok: false, error: message }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
