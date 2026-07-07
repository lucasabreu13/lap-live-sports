import type { Metadata } from "next";
import { FavoritesHub } from "@/components/live-hubs";
export const metadata: Metadata = { title: "Favoritos | LAP", description: "Acompanhe suas modalidades e partidas favoritas na LAP." };
export default function FavoritesPage() { return <FavoritesHub />; }
