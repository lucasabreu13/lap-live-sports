import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LAP Live Sports",
    short_name: "LAP",
    description: "Notícias, jogos e resultados no ritmo do agora.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f7f7",
    theme_color: "#0f1718",
    lang: "pt-BR",
    icons: [{ src: "/icons/lap-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}
