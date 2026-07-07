import { getLiveHealth, getLivePayload } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const health = getLiveHealth(await getLivePayload());
    return Response.json(health, { status: health.status === "operational" ? 200 : 206, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "unavailable", generatedAt: new Date().toISOString() }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
