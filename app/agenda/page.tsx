import type { Metadata } from "next";
import { ScheduleHub } from "@/components/live-hubs";
export const metadata: Metadata = { title: "Agenda esportiva | LAP", description: "Jogos ao vivo, próximos eventos e resultados por modalidade na LAP." };
export default function SchedulePage() { return <ScheduleHub />; }
