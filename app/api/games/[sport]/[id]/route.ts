import { SPORTS, type SportId } from "@/lib/live-data";
import { getResilientGameDetails } from "@/lib/resilient-game-details";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = { params: Promise<{ sport: string; id: string }>; };

export async function GET(request: Request, { params }: RouteProps) {
  const { sport, id } = await params;
  if (!SPORTS.some((item) => item.id === sport)) return Response.json({ error: "Modalidade não encontrada." }, { status: 404 });
  const worldCup = new URL(request.url).searchParams.get("torneio") === "copa-2026";
  const details = await getResilientGameDetails(sport as SportId, id, { worldCup });
  if (!details) return Response.json({ error: "Evento não encontrado na fonte nem no cache da LAP." }, { status: 404 });
  return Response.json(details, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
