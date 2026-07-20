import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 78px",
        background: "#0f1718",
        color: "white",
        fontFamily: "Arial, Helvetica, sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 34 }}>
        <svg width="138" height="138" viewBox="0 0 512 512">
          <circle cx="256" cy="256" r="154" fill="none" stroke="#00b89c" strokeWidth="28" strokeLinecap="round" strokeDasharray="252 72 168 76" transform="rotate(-28 256 256)" />
          <path d="M178 205c-24 27-36 57-36 91s12 64 36 91" fill="none" stroke="#ffffff" strokeWidth="27" strokeLinecap="round" />
          <path d="M334 205c24 27 36 57 36 91s-12 64-36 91" fill="none" stroke="#ffffff" strokeWidth="27" strokeLinecap="round" />
          <circle cx="256" cy="296" r="42" fill="#00b89c" />
        </svg>
        <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
          <div style={{ fontSize: 122, fontWeight: 900, letterSpacing: -10, lineHeight: 1 }}>LAP</div>
          <div style={{ width: 3, height: 96, background: "#00b89c" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
            <div style={{ color: "#00d2b2", fontSize: 34, fontWeight: 800, letterSpacing: 12 }}>LIVE</div>
            <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8 }}>SPORTS</div>
          </div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ color: "#bdece6", fontSize: 24, fontWeight: 800, letterSpacing: 2 }}>JOGO A JOGO. HISTÓRIA A HISTÓRIA.</div>
        <div style={{ maxWidth: 900, fontSize: 54, lineHeight: 1.04, fontWeight: 900, letterSpacing: -2 }}>Jogos, resultados, notícias e contexto esportivo em uma única central.</div>
      </div>
    </div>,
    size,
  );
}
