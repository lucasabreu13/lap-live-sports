import { NextResponse } from "next/server";
import { normalizePushPreferences, sanitizeFavoriteIds, upsertPushSubscription } from "@/lib/push-store";

export const runtime = "nodejs";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validateSubscription(value: unknown) {
  const subscription = asObject(value);
  const keys = asObject(subscription.keys);
  const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint : "";
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh : "";
  const auth = typeof keys.auth === "string" ? keys.auth : "";
  if (!endpoint.startsWith("https://") || p256dh.length < 20 || auth.length < 10) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(request: Request) {
  try {
    const body = asObject(await request.json());
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    const subscription = validateSubscription(body.subscription);
    if (deviceId.length < 12 || !subscription) {
      return NextResponse.json({ error: "Assinatura Push inválida." }, { status: 400 });
    }
    const preferences = normalizePushPreferences({ ...asObject(body.preferences), enabled: true });
    const record = await upsertPushSubscription({
      deviceId,
      endpoint: subscription.endpoint,
      p256dh: subscription.p256dh,
      auth: subscription.auth,
      userAgent: request.headers.get("user-agent"),
      preferences: { ...preferences, enabled: true },
      favoriteIds: sanitizeFavoriteIds(body.favoriteIds),
    });
    return NextResponse.json({ ok: true, deviceId: record.deviceId, enabled: record.enabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao salvar assinatura Push.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
