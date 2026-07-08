import { NextResponse } from "next/server";
import { alertDeliveryKey } from "@/lib/push-alerts";
import { getPushSubscriptionByDevice, reservePushDelivery, updatePushDeliveryStatus } from "@/lib/push-store";
import { sendWebPush } from "@/lib/web-push";

export const runtime = "nodejs";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && request.headers.get("authorization") === `Bearer ${secret}`);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = asObject(await request.json());
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (deviceId.length < 12) return NextResponse.json({ error: "deviceId inválido." }, { status: 400 });
    const subscription = await getPushSubscriptionByDevice(deviceId);
    if (!subscription) return NextResponse.json({ error: "Assinatura ativa não encontrada." }, { status: 404 });

    const alert = {
      eventKey: "manual-test",
      eventType: "test" as const,
      eventHash: new Date().toISOString(),
    };
    const reserved = await reservePushDelivery({
      subscriptionId: subscription.id,
      deviceId: subscription.deviceId,
      eventKey: alert.eventKey,
      eventType: alert.eventType,
      eventHash: alert.eventHash,
    });
    if (!reserved) return NextResponse.json({ ok: true, skipped: true });

    const result = await sendWebPush(subscription, {
      title: "LAP · Teste de alerta",
      body: "Se você recebeu isso, o Web Push da LAP está ativo neste dispositivo.",
      url: "/favoritos",
      tag: alertDeliveryKey(subscription.id, alert),
      eventKey: alert.eventKey,
      eventType: alert.eventType,
    });
    await updatePushDeliveryStatus({
      subscriptionId: subscription.id,
      eventKey: alert.eventKey,
      eventType: alert.eventType,
      eventHash: alert.eventHash,
      status: result.ok ? "sent" : result.expired ? "expired" : "failed",
      errorMessage: result.errorMessage,
    });
    return NextResponse.json({ ok: result.ok, expired: result.expired, statusCode: result.statusCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha no teste de Push.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
