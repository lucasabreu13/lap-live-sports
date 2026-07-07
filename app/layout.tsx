import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lap.local";

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
};

export const viewport: Viewport = { themeColor: "#0f1718", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
