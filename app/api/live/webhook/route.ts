import { timingSafeEqual } from "node:crypto";
import { ingestLiveWebhook, type LiveWebhookPatch } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function authorized(request: Request) {
  const expected = process.env.LAP_LIVE_WEBHOOK_TOKEN;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Webhook não autorizado." }, { status: 401 });
  try {
    const patch = await request.json() as LiveWebhookPatch;
    const accepted = ingestLiveWebhook(patch);
    return Response.json({ ok: true, ...accepted }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Webhook inválido." }, { status: 400 });
  }
}
