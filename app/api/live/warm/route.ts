import { NextResponse } from "next/server";
import { warmFreeLivePayload } from "@/lib/free-live-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function handle(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await warmFreeLivePayload();
    return NextResponse.json({ ok: true, result }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao aquecer cache ao vivo.";
    return NextResponse.json({ ok: false, error: message }, { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
