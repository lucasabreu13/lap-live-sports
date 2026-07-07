import { getGameDetails, type SportId, SPORTS } from "@/lib/live-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = { params: Promise<{ sport: string; id: string }>; };

export async function GET(request: Request, { params }: RouteProps) {
  const { sport, id } = await params;
  if (!SPORTS.some((item) => item.id === sport)) return Response.json({ error: "Modalidade não encontrada." }, { status: 404 });
  const worldCup = new URL(request.url).searchParams.get("torneio") === "copa-2026";
  const details = await getGameDetails(sport as SportId, id, { worldCup });
  if (!details) return Response.json({ error: "Partida não encontrada ou sem detalhes disponíveis." }, { status: 404 });
  return Response.json(details, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
