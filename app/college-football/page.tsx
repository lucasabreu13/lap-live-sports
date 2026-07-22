import type { Metadata } from "next";
import { CollegeFootballCenter } from "@/components/college-football-center";
import { CollegeFootballEditorialStrip } from "@/components/college-football-editorial-strip";
import { LapHeader } from "@/components/lap-header";
import { getCollegeFootballHub } from "@/lib/college-football-data";

export const metadata: Metadata = {
  title: "College Football",
  description: "Central completa de College Football com FBS, FCS, Division II e Division III, times, estádios, elencos, calendário, notícias verificadas e história de títulos com dados reais.",
};

export default async function CollegeFootballPage() {
  const hub = await getCollegeFootballHub();

  return (
    <>
      <LapHeader />
      <CollegeFootballEditorialStrip />
      <CollegeFootballCenter hub={hub} />
    </>
  );
}
