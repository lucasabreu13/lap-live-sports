import type { Metadata, Viewport } from "next";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import "./globals.css";
import "./lap-ux-polish.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LAP | Live Sports", template: "%s | LAP" },
  description: "Acompanhe jogos, resultados, notícias e histórias do esporte em um só lugar.",
  applicationName: "LAP Live Sports",
  manifest: "/manifest.webmanifest",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  openGraph: { type: "website", locale: "pt_BR", siteName: "LAP", title: "LAP | Live Sports", description: "Jogo a jogo, história a história." },
  twitter: { card: "summary", title: "LAP | Live Sports", description: "Jogo a jogo, história a história." },
  icons: { icon: "/icons/lap-icon.svg", apple: "/icons/lap-icon.svg" },
  keywords: ["esportes ao vivo", "resultados", "agenda esportiva", "futebol", "Formula 1", "NFL", "basquete"],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export const viewport: Viewport = { themeColor: "#0f1718", colorScheme: "light", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}<MobileBottomNav /></body></html>;
}
