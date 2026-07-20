import { getCachedLivePayload, refreshCachedLivePayload } from "@/lib/free-live-data";
import { toPublicLivePayload } from "@/lib/public-sports";

export const dynamic = "force-dynamic";

function responseHeaders(manualRefresh: boolean): Record<string, string> {
  if (manualRefresh) {
    return { "Cache-Control": "no-store, max-age=0" };
  }
  return {
    "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120, stale-if-error=86400",
    "CDN-Cache-Control": "public, s-maxage=20, stale-while-revalidate=120, stale-if-error=86400",
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const manualRefresh = url.searchParams.get("refresh") === "1";
  const includeWorldCup = url.searchParams.get("includeWorldCup") === "1";
  try {
    const payload = manualRefresh
      ? await refreshCachedLivePayload()
      : await getCachedLivePayload();

    return Response.json(toPublicLivePayload(payload, { includeWorldCup }), { headers: responseHeaders(manualRefresh) });
  } catch {
    return Response.json(
      { error: "Não foi possível atualizar os dados esportivos agora." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
