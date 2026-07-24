import type { Metadata, Viewport } from "next";
import { DataAutoRefresh } from "@/components/data-auto-refresh";
import { DataVisibilityGuard } from "@/components/data-visibility-guard";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";
import "./globals.css";
import "./lap-ux-polish.css";
import "./lap-header-polish.css";
import "./lap-brand.css";
import "./lap-gallery.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://lap-live-sports.vercel.app";
const buildSha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "local";
const shellVersion = "editorial-v4-gallery";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "LAP | Live Sports", template: "%s | LAP" },
  description: "Acompanhe jogos, resultados, notícias e histórias do esporte em um só lugar.",
  applicationName: "LAP Live Sports",
  manifest: "/manifest.webmanifest",
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
  other: { "lap-shell": shellVersion, "lap-build": buildSha },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "LAP Live Sports",
    title: "LAP | Live Sports",
    description: "Jogo a jogo, história a história.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "LAP Live Sports" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LAP | Live Sports",
    description: "Jogo a jogo, história a história.",
    images: ["/twitter-image"],
  },
  icons: {
    icon: [{ url: "/icons/lap-icon.svg", type: "image/svg+xml" }],
    shortcut: "/icons/lap-icon.svg",
    apple: "/apple-icon",
  },
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

export const viewport: Viewport = { themeColor: "#111111", colorScheme: "light", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><DataVisibilityGuard /><DataAutoRefresh />{children}<MobileBottomNav /></body></html>;
}
