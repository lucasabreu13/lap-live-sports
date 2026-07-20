import { NextRequest, NextResponse } from "next/server";
import { COLLEGE_DIVISIONS, getCollegeTeamDetail, type CollegeDivision } from "@/lib/college-football-data";

type RouteContext = { params: Promise<{ id: string }> };

function isDivision(value: string | null): value is CollegeDivision {
  return Boolean(value && Object.prototype.hasOwnProperty.call(COLLEGE_DIVISIONS, value));
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const divisionParam = request.nextUrl.searchParams.get("division");
  if (!id || !isDivision(divisionParam)) {
    return NextResponse.json({ error: "Time ou divisão inválidos." }, { status: 400 });
  }

  const detail = await getCollegeTeamDetail(id, divisionParam);
  if (!detail) {
    return NextResponse.json({ error: "Dados oficiais do time não foram encontrados agora." }, { status: 404 });
  }

  return NextResponse.json(detail, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600",
    },
  });
}
