import { NextResponse } from "next/server";
import { normalizePushPreferences, sanitizeFavoriteIds, updatePushDevicePreferences } from "@/lib/push-store";

export const runtime = "nodejs";

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function PUT(request: Request) {
  try {
    const body = asObject(await request.json());
    const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (deviceId.length < 12) return NextResponse.json({ error: "deviceId inválido." }, { status: 400 });
    const preferences = normalizePushPreferences(body.preferences);
    const enabled = typeof body.enabled === "boolean" ? body.enabled : preferences.enabled;
    const record = await updatePushDevicePreferences({
      deviceId,
      preferences: { ...preferences, enabled },
      favoriteIds: sanitizeFavoriteIds(body.favoriteIds),
      enabled,
    });
    return NextResponse.json({ ok: true, synced: Boolean(record), enabled: record?.enabled ?? false });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao sincronizar preferências.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
