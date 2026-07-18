import { timingSafeEqual } from "node:crypto";
import { ingestCachedLiveWebhook } from "@/lib/free-live-data";
import type { LiveWebhookPatch } from "@/lib/live-data";
import { runPushMonitorForEvents } from "@/lib/push-alerts";
import { isWebPushConfigured } from "@/lib/web-push";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 30;

function authorized(request: Request) {
  const expected = process.env.LAP_LIVE_WEBHOOK_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Webhook nao autorizado." }, { status: 401 });
  try {
    const patch = await request.json() as LiveWebhookPatch;
    const accepted = await ingestCachedLiveWebhook(patch);
    let notifications = null;

    if (accepted.score && isWebPushConfigured()) {
      try {
        notifications = await runPushMonitorForEvents(
          [accepted.score],
          accepted.previousScore ? [accepted.previousScore] : [],
          patch.occurredAt ? new Date(patch.occurredAt) : new Date(),
        );
      } catch (error) {
        console.error("Falha ao entregar alerta imediato do webhook.", error);
      }
    }

    return Response.json({
      ok: true,
      acceptedAt: accepted.acceptedAt,
      matched: Boolean(accepted.score),
      notifications,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook invalido." }, { status: 400 });
  }
}
