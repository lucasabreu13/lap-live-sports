import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f1718" }}>
      <svg width="150" height="150" viewBox="0 0 512 512">
        <circle cx="256" cy="256" r="154" fill="none" stroke="#00b89c" strokeWidth="28" strokeLinecap="round" strokeDasharray="252 72 168 76" transform="rotate(-28 256 256)" />
        <path d="M178 205c-24 27-36 57-36 91s12 64 36 91" fill="none" stroke="#ffffff" strokeWidth="27" strokeLinecap="round" />
        <path d="M334 205c24 27 36 57 36 91s-12 64-36 91" fill="none" stroke="#ffffff" strokeWidth="27" strokeLinecap="round" />
        <circle cx="256" cy="296" r="42" fill="#00b89c" />
      </svg>
    </div>,
    size,
  );
}
