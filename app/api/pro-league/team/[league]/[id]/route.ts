import { NextRequest, NextResponse } from "next/server";
import { getProTeamDetail, PRO_LEAGUES, type ProLeagueId } from "@/lib/rich-team-league-data";

type Context = { params: Promise<{ league: string; id: string }> };

function isLeague(value: string): value is ProLeagueId {
  return Object.prototype.hasOwnProperty.call(PRO_LEAGUES, value);
}

export async function GET(_request: NextRequest, context: Context) {
  const { league, id } = await context.params;
  if (!isLeague(league) || !id) return NextResponse.json({ error: "Liga ou time inválido." }, { status: 400 });
  const detail = await getProTeamDetail(league, id);
  if (!detail) return NextResponse.json({ error: "Os dados do time não estão disponíveis agora." }, { status: 404 });
  return NextResponse.json(detail, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } });
}
