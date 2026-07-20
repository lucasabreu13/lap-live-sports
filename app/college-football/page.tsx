import type { Metadata } from "next";
import { CollegeFootballCenter } from "@/components/college-football-center";
import { LapHeader } from "@/components/lap-header";
import { getCollegeFootballHub } from "@/lib/college-football-data";

export const metadata: Metadata = {
  title: "College Football | LAP Live Sports",
  description: "Central completa de College Football com FBS, FCS, Division II e Division III, times, estádios, elencos, calendário e história de títulos com dados reais.",
};

export default async function CollegeFootballPage() {
  const hub = await getCollegeFootballHub();

  return (
    <>
      <LapHeader />
      <CollegeFootballCenter hub={hub} />
    </>
  );
}
