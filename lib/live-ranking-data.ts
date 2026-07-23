import rankingFallbacks from "@/content/rankings/official-rankings.json";

export type LiveRankingKey = keyof typeof rankingFallbacks;

export type LiveRanking = {
  title: string;
  asOf: string;
  sourceLabel: string;
  sourceUrl: string;
  columns: string[];
  rows: string[][];
  mode: "live" | "fallback";
};

type Snapshot = (typeof rankingFallbacks)[LiveRankingKey];

const FETCH_TTL = {
  tennis: 30 * 60,
  golf: 60 * 60,
  surf: 10 * 60,
} as const;

function cleanText(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlRows(html: string) {
  return (html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
    .map((row) => (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(cleanText).filter(Boolean))
    .filter((cells) => cells.length >= 2);
}

function numberValue(value: string) {
  const cleaned = value.replace(/[^0-9.,-]/g, "").trim();
  if (!cleaned) return null;
  const normalized = cleaned.includes(",") && cleaned.includes(".")
    ? cleaned.replace(/,/g, "")
    : cleaned.replace(/,/g, ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function rankValue(value: string) {
  const match = value.match(/-?\d{1,4}/);
  if (!match) return null;
  const parsed = Math.abs(Number(match[0]));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function looksLikePerson(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  return /[A-Za-zÀ-ÿ]/.test(text)
    && text.length >= 5
    && text.split(/\s+/).length >= 2
    && !/rank|player|jogador|jogadora|points|pontos|country|país|change|average|total|events|played/i.test(text);
}

function looksLikeCountry(value: string) {
  return /^[A-Z]{3}$/.test(value.trim());
}

async function fetchText(url: string, revalidate: number) {
  try {
    const response = await fetch(url, {
      next: { revalidate },
      headers: { "user-agent": "Mozilla/5.0 LAP Live Sports/7.0" },
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

function snapshot(key: LiveRankingKey): LiveRanking {
  const item = rankingFallbacks[key] as Snapshot;
  return {
    title: item.title,
    asOf: item.asOf,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    columns: [...item.columns],
    rows: item.rows.map((row) => row.map(String)),
    mode: "fallback",
  };
}

function formatAsOf(prefix = "atualização automática") {
  return `${prefix}: ${new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date())}`;
}

function validateTopRows(rows: string[][], minimum = 5) {
  if (rows.length < minimum) return false;
  return rows.slice(0, minimum).every((row, index) => Number(row[0]) === index + 1 && Boolean(row[1]));
}

function parseTennis(html: string, women: boolean) {
  const parsed = htmlRows(html).flatMap((cells) => {
    const rank = rankValue(cells[0] || "");
    if (!rank || rank > 100) return [];
    const nameIndex = cells.findIndex((cell, index) => index > 0 && looksLikePerson(cell));
    if (nameIndex < 0) return [];
    const name = cells[nameIndex].replace(/^[+\-–—\d\s]+/, "").trim();
    if (!looksLikePerson(name)) return [];
    const numericAfter = cells.slice(nameIndex + 1)
      .map((cell) => ({ cell, value: numberValue(cell) }))
      .filter((item): item is { cell: string; value: number } => item.value !== null && item.value >= 0);
    const pointsItem = [...numericAfter].sort((a, b) => b.value - a.value)[0];
    if (!pointsItem || pointsItem.value < 100) return [];
    const country = cells.find((cell) => looksLikeCountry(cell)) || "";
    return [women
      ? [String(rank), name, country, pointsItem.cell.replace(/\s+/g, "")]
      : [String(rank), name, pointsItem.cell.replace(/\s+/g, "")]];
  });
  return Array.from(new Map(parsed.map((row) => [row[0], row])).values())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(0, 10);
}

function parseRolex(html: string) {
  const parsed = htmlRows(html).flatMap((cells) => {
    const rank = rankValue(cells[0] || "");
    if (!rank || rank > 50) return [];
    const countryIndex = cells.findIndex((cell) => looksLikeCountry(cell));
    const nameIndex = cells.findIndex((cell, index) => index > 0 && looksLikePerson(cell));
    if (nameIndex < 0) return [];
    const after = cells.slice(nameIndex + 1)
      .map((cell) => ({ cell, value: numberValue(cell) }))
      .filter((item): item is { cell: string; value: number } => item.value !== null && item.value >= 0);
    if (after.length < 2) return [];
    return [[String(rank), cells[nameIndex], countryIndex >= 0 ? cells[countryIndex] : "", after[0].cell, after[1].cell]];
  });
  return Array.from(new Map(parsed.map((row) => [row[0], row])).values())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(0, 10);
}

function parseOwgr(html: string) {
  const parsed = htmlRows(html).flatMap((cells) => {
    const rank = rankValue(cells[0] || "");
    if (!rank || rank > 50) return [];
    const nameIndex = cells.findIndex((cell, index) => index > 0 && looksLikePerson(cell));
    if (nameIndex < 0) return [];
    const after = cells.slice(nameIndex + 1)
      .map((cell) => ({ cell, value: numberValue(cell) }))
      .filter((item): item is { cell: string; value: number } => item.value !== null && item.value >= 0);
    if (after.length < 2) return [];
    return [[String(rank), cells[nameIndex], after[0].cell, after[1].cell]];
  });
  return Array.from(new Map(parsed.map((row) => [row[0], row])).values())
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .slice(0, 10);
}

function surfCountryFallback(name: string, key: "wslMen" | "wslWomen") {
  const fallback = snapshot(key).rows.find((row) => row[1].toLowerCase() === name.toLowerCase());
  return fallback?.[2] || "";
}

function parseSurfSection(text: string, start: string, end: string, key: "wslMen" | "wslWomen") {
  const startIndex = text.toLowerCase().indexOf(start.toLowerCase());
  if (startIndex < 0) return [];
  const remaining = text.slice(startIndex + start.length);
  const endIndex = remaining.toLowerCase().indexOf(end.toLowerCase());
  const section = endIndex >= 0 ? remaining.slice(0, endIndex) : remaining.slice(0, 2500);
  const rows: string[][] = [];
  const regex = /(\d{1,2})\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ'’ .-]{3,}?)\s+(\d{1,3}[.,]\d{3})(?=\s*\d{1,2}\s*[A-ZÀ-Ý]|\s*Ver ranking completo|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section)) && rows.length < 10) {
    const rank = Number(match[1]);
    const name = match[2].replace(/\s+/g, " ").trim();
    if (rank !== rows.length + 1 || !looksLikePerson(name)) continue;
    rows.push([String(rank), name, surfCountryFallback(name, key), match[3].replace(",", ".")]);
  }
  return rows;
}

async function loadAtp() {
  const html = await fetchText("https://www.atptour.com/en/rankings/singles?ajax=true&rankRange=0-100", FETCH_TTL.tennis);
  if (!html) return snapshot("atp");
  const rows = parseTennis(html, false);
  return validateTopRows(rows) ? {
    ...snapshot("atp"),
    rows,
    asOf: formatAsOf(),
    sourceLabel: "ATP Tour — ranking oficial",
    mode: "live" as const,
  } : snapshot("atp");
}

async function loadWta() {
  const html = await fetchText("https://www.wtatennis.com/rankings/singles", FETCH_TTL.tennis);
  if (!html) return snapshot("wta");
  const rows = parseTennis(html, true);
  return validateTopRows(rows) ? {
    ...snapshot("wta"),
    rows,
    asOf: formatAsOf(),
    sourceLabel: "WTA Tennis — ranking oficial",
    mode: "live" as const,
  } : snapshot("wta");
}

async function loadOwgr() {
  const html = await fetchText("https://www.owgr.com/sharing-widget?pageSize=10&text=WORLD%27S+TOP+10", FETCH_TTL.golf);
  if (!html) return snapshot("owgr");
  const rows = parseOwgr(html);
  return validateTopRows(rows) ? {
    ...snapshot("owgr"),
    rows,
    asOf: formatAsOf(),
    sourceLabel: "OWGR — widget oficial atualizado automaticamente",
    sourceUrl: "https://www.owgr.com/current-world-ranking",
    mode: "live" as const,
  } : snapshot("owgr");
}

async function loadRolex() {
  const html = await fetchText("https://www.rolexrankings.com/rankings", FETCH_TTL.golf);
  if (!html) return snapshot("rolex");
  const rows = parseRolex(html);
  return validateTopRows(rows) ? {
    ...snapshot("rolex"),
    rows,
    asOf: formatAsOf(),
    sourceLabel: "Rolex Rankings — ranking oficial",
    mode: "live" as const,
  } : snapshot("rolex");
}

async function loadSurfPair() {
  const html = await fetchText("https://previsaodosurf.com.br/competicoes", FETCH_TTL.surf);
  if (!html) return { wslMen: snapshot("wslMen"), wslWomen: snapshot("wslWomen") };
  const text = cleanText(html);
  const menRows = parseSurfSection(text, "WSL Championship Tour Masculino 2026", "Ver ranking completo", "wslMen");
  const womenStart = text.indexOf("WSL Championship Tour Feminino 2026");
  const womenText = womenStart >= 0 ? text.slice(womenStart) : text;
  const womenRows = parseSurfSection(womenText, "WSL Championship Tour Feminino 2026", "Ver ranking completo", "wslWomen");
  const liveAsOf = formatAsOf("espelho público consultado");
  return {
    wslMen: validateTopRows(menRows) ? { ...snapshot("wslMen"), rows: menRows, asOf: liveAsOf, sourceLabel: "WSL — atualização automática com conferência pública", mode: "live" as const } : snapshot("wslMen"),
    wslWomen: validateTopRows(womenRows) ? { ...snapshot("wslWomen"), rows: womenRows, asOf: liveAsOf, sourceLabel: "WSL — atualização automática com conferência pública", mode: "live" as const } : snapshot("wslWomen"),
  };
}

export async function getLiveRanking(key: LiveRankingKey): Promise<LiveRanking> {
  if (key === "atp") return loadAtp();
  if (key === "wta") return loadWta();
  if (key === "owgr") return loadOwgr();
  if (key === "rolex") return loadRolex();
  const surf = await loadSurfPair();
  return key === "wslMen" ? surf.wslMen : surf.wslWomen;
}

export async function warmLiveRankings() {
  const [atp, wta, owgr, rolex, surf] = await Promise.all([
    loadAtp(),
    loadWta(),
    loadOwgr(),
    loadRolex(),
    loadSurfPair(),
  ]);
  return { atp, wta, owgr, rolex, wslMen: surf.wslMen, wslWomen: surf.wslWomen };
}
