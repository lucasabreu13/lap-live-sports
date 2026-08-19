import { NextResponse } from "next/server";
import { runPushMonitor } from "@/lib/push-alerts";

export const runtime = "nodejs";

const MONITOR_TIMEOUT_MS = 40_000;

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

async function handle(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const startedAt = Date.now();
  console.info("[push-monitor] started");

  try {
    const result = await withTimeout(
      runPushMonitor(),
      MONITOR_TIMEOUT_MS,
      "Tempo limite atingido ao atualizar os dados do monitor Push.",
    );
    const durationMs = Date.now() - startedAt;
    console.info("[push-monitor] completed", { durationMs, ...result });
    return NextResponse.json({ ok: true, result, durationMs });
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Falha ao executar monitor Push.";
    console.error("[push-monitor] failed", { durationMs, error: message });
    return NextResponse.json({ ok: false, error: message, durationMs }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
