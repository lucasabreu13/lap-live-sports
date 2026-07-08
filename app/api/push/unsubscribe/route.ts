import { NextResponse } from "next/server";
import { disablePushSubscription } from "@/lib/push-store";

export const runtime = "nodejs";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function DELETE(request: Request) {
  try {
    const body = asObject(await request.json().catch(() => ({})));
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : undefined;
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : undefined;
    if (!deviceId && !endpoint) return NextResponse.json({ error: "Informe deviceId ou endpoint." }, { status: 400 });
    await disablePushSubscription({ deviceId, endpoint });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao desativar assinatura.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
