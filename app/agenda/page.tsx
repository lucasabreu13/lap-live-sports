import type { Metadata } from "next";
import { ScheduleExperience } from "@/components/schedule-experience";

export const metadata: Metadata = {
  title: "Agenda esportiva | LAP",
  description: "Jogos ao vivo, proximos eventos e resultados por modalidade na LAP.",
};

export default function SchedulePage() {
  return <ScheduleExperience />;
}