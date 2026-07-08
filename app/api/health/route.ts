import { getCachedLivePayload } from "@/lib/free-live-data";
import { getLiveHealth } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const health = getLiveHealth(await getCachedLivePayload());
    return Response.json(health, { status: health.status === "operational" ? 200 : 206, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", generatedAt: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
