import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProTeamPage } from "@/components/pro-team-page";
import { getProLeagueHub, getProTeamDetail, PRO_LEAGUES, type ProLeagueId } from "@/lib/rich-team-league-data";

type PageProps = { params: Promise<{ league: string; id: string }> };

function isLeague(value: string): value is ProLeagueId {
  return value in PRO_LEAGUES;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { league, id } = await params;
  if (!isLeague(league)) return { title: "Time não encontrado | LAP" };
  const detail = await getProTeamDetail(league, id);
  if (!detail) return { title: "Time não encontrado | LAP" };
  return { title: `${detail.team.name} | ${league.toUpperCase()} | LAP`, description: `Elenco, campanha, agenda, resultados e notícias de ${detail.team.name} na LAP.` };
}

export default async function TeamPage({ params }: PageProps) {
  const { league, id } = await params;
  if (!isLeague(league)) notFound();
  const [detail, hub] = await Promise.all([getProTeamDetail(league, id), getProLeagueHub(league)]);
  if (!detail) notFound();
  const names = [detail.team.name, detail.team.shortName, detail.team.location, detail.team.abbreviation].map((value) => value.toLowerCase()).filter(Boolean);
  const news = hub.news.filter((item) => names.some((name) => `${item.title} ${item.excerpt}`.toLowerCase().includes(name))).slice(0, 12);
  return <ProTeamPage detail={detail} news={news} />;
}
