import { after } from "next/server";
import { getCachedLivePayload, refreshCachedLivePayload, refreshCachedLivePayloadInBackground } from "@/lib/free-live-data";

export const dynamic = "force-dynamic";

function responseHeaders(manualRefresh: boolean) {
  if (manualRefresh) {
    return { "Cache-Control": "no-store, max-age=0" };
  }
  return {
    "Cache-Control": "public, s-maxage=20, stale-while-revalidate=120, stale-if-error=86400",
    "CDN-Cache-Control": "public, s-maxage=20, stale-while-revalidate=120, stale-if-error=86400",
  };
}

export async function GET(request: Request) {
  const manualRefresh = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    const payload = manualRefresh
      ? await refreshCachedLivePayload()
      : await getCachedLivePayload({ preferCached: true });

    if (!manualRefresh) {
      after(async () => {
        await refreshCachedLivePayloadInBackground();
      });
    }

    return Response.json(payload, { headers: responseHeaders(manualRefresh) });
  } catch {
    return Response.json(
      { error: "Não foi possível atualizar os dados esportivos agora." },
      { status: 503, headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  }
}
