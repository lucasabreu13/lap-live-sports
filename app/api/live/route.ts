import { getCachedLivePayload } from "@/lib/free-live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const payload = await getCachedLivePayload();
    return Response.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    return Response.json(
      { error: "As fontes ao vivo não responderam neste momento." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
