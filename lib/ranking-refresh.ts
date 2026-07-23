import fallbacks from "@/content/rankings/official-rankings.json";

export type RankingKey = keyof typeof fallbacks;
export type RefreshedRanking = {
  title: string;
  asOf: string;
  sourceLabel: string;
  sourceUrl: string;
  columns: string[];
  rows: string[][];
  isFallback: boolean;
};

const TTL = { tennis: 1800, golf: 3600, surf: 600 } as const;

function clean(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#x27;|&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function text(url: string, revalidate: number) {
  try {
    const response = await fetch(url, {
      next: { revalidate },
      headers: { "user-agent": "Mozilla/5.0 LAP Live Sports/7.1" },
    });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

function rowsFromHtml(html: string) {
  return (html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [])
    .map((row) => (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(clean).filter(Boolean))
    .filter((row) => row.length > 1);
}

function fallback(key: RankingKey): RefreshedRanking {
  const item = fallbacks[key];
  return {
    title: item.title,
    asOf: item.asOf,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    columns: [...item.columns],
    rows: item.rows.map((row) => row.map(String)),
    isFallback: true,
  };
}

function nowLabel(prefix = "fonte consultada") {
  const date = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  return `${prefix} em ${date}`;
}

function rank(cell: string) {
  const match = cell.match(/-?\d{1,4}/);
  const value = match ? Math.abs(Number(match[0])) : NaN;
  return Number.isFinite(value) && value > 0 ? value : null;
}

function numeric(cell: string) {
  const raw = cell.replace(/[^0-9.,-]/g, "");
  if (!raw) return null;
  let normalized = raw;
  if (/^-?\d{1,3},\d{3}$/.test(raw)) normalized = raw.replace(",", "");
  else if (raw.includes(",") && raw.includes(".")) normalized = raw.replace(/,/g, "");
  else if (raw.includes(",")) normalized = raw.replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function person(cell: string) {
  const normalized = cell
    .replace(/^[+\-–—\d\s]+/, "")
    .replace(/(?:\s+[A-Z]{3}){1,2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < 5 || normalized.split(" ").length < 2) return null;
  if (!/[A-Za-zÀ-ÿ]/.test(normalized)) return null;
  if (/rank|player|jogador|points|pontos|country|país|average|events|played/i.test(normalized)) return null;
  return normalized;
}

function country(cells: string[]) {
  const direct = cells.find((cell) => /^[A-Z]{3}$/.test(cell.trim()));
  if (direct) return direct.trim();
  const joined = cells.join(" ");
  const match = joined.match(/\b[A-Z]{3}\b/);
  return match?.[0] || "";
}

function topValid(rows: string[][], min = 5) {
  return rows.length >= min && rows.slice(0, min).every((row, index) => Number(row[0]) === index + 1 && Boolean(row[1]));
}

function bestByRank(rows: string[][]) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const current = map.get(row[0]);
    if (!current || row[1].length > current[1].length) map.set(row[0], row);
  }
  return [...map.values()].sort((a, b) => Number(a[0]) - Number(b[0])).slice(0, 10);
}

function tennisRows(html: string, women: boolean) {
  const parsed = rowsFromHtml(html).flatMap((cells) => {
    const position = rank(cells[0] || "");
    if (!position || position > 100) return [];
    const nameIndex = cells.findIndex((cell, index) => index > 0 && person(cell));
    if (nameIndex < 0) return [];
    const name = person(cells[nameIndex]);
    if (!name) return [];
    const after = cells.slice(nameIndex + 1)
      .map((cell) => ({ cell, value: numeric(cell) }))
      .filter((item): item is { cell: string; value: number } => item.value !== null);
    const points = [...after].sort((a, b) => b.value - a.value)[0];
    if (!points || points.value < 100) return [];
    return [women
      ? [String(position), name, country(cells) || fallback("wta").rows.find((row) => row[1] === name)?.[2] || "", points.cell]
      : [String(position), name, points.cell]];
  });
  return bestByRank(parsed);
}

function rolexRows(html: string) {
  const parsed = rowsFromHtml(html).flatMap((cells) => {
    const position = rank(cells[0] || "");
    if (!position || position > 50) return [];
    const nameIndex = cells.findIndex((cell, index) => index > 0 && person(cell));
    const name = nameIndex >= 0 ? person(cells[nameIndex]) : null;
    if (!name) return [];
    const after = cells.slice(nameIndex + 1)
      .map((cell) => ({ cell, value: numeric(cell) }))
      .filter((item): item is { cell: string; value: number } => item.value !== null);
    if (after.length < 2) return [];
    return [[String(position), name, country(cells), after[0].cell, after[1].cell]];
  });
  return bestByRank(parsed);
}

function owgrRows(html: string) {
  const parsed = rowsFromHtml(html).flatMap((cells) => {
    const position = rank(cells[0] || "");
    if (!position || position > 50) return [];
    const nameIndex = cells.findIndex((cell, index) => index > 0 && person(cell));
    const name = nameIndex >= 0 ? person(cells[nameIndex]) : null;
    if (!name) return [];
    const after = cells.slice(nameIndex + 1)
      .map((cell) => ({ cell, value: numeric(cell) }))
      .filter((item): item is { cell: string; value: number } => item.value !== null);
    if (after.length < 2) return [];
    return [[String(position), name, after[0].cell, after[1].cell]];
  });
  return bestByRank(parsed);
}

function surfCountry(name: string, key: "wslMen" | "wslWomen") {
  return fallback(key).rows.find((row) => row[1].toLowerCase() === name.toLowerCase())?.[2] || "";
}

function surfRows(pageText: string, heading: string, key: "wslMen" | "wslWomen") {
  const lower = pageText.toLowerCase();
  const start = lower.indexOf(heading.toLowerCase());
  if (start < 0) return [];
  const body = pageText.slice(start + heading.length, start + heading.length + 2200);
  const end = body.toLowerCase().indexOf("ver ranking completo");
  const section = end >= 0 ? body.slice(0, end) : body;
  const output: string[][] = [];
  const regex = /(\d{1,2})\s*([A-ZÀ-Ý][A-Za-zÀ-ÿ'’ .-]{3,}?)\s+(\d{1,3}[.,]\d{3})(?=\s*\d{1,2}\s*[A-ZÀ-Ý]|$)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(section)) && output.length < 10) {
    const position = Number(match[1]);
    const name = match[2].replace(/\s+/g, " ").trim();
    if (position !== output.length + 1 || !person(name)) continue;
    output.push([String(position), name, surfCountry(name, key), match[3].replace(",", ".")]);
  }
  return output;
}

async function atp() {
  const base = fallback("atp");
  const html = await text("https://www.atptour.com/en/rankings/singles?ajax=true&rankRange=0-100", TTL.tennis);
  if (!html) return base;
  const rows = tennisRows(html, false);
  return topValid(rows) ? { ...base, rows, asOf: nowLabel(), sourceLabel: "ATP Tour — ranking oficial", isFallback: false } : base;
}

async function wta() {
  const base = fallback("wta");
  const html = await text("https://www.wtatennis.com/rankings/singles", TTL.tennis);
  if (!html) return base;
  const rows = tennisRows(html, true);
  return topValid(rows) ? { ...base, rows, asOf: nowLabel(), sourceLabel: "WTA Tennis — ranking oficial", isFallback: false } : base;
}

async function owgr() {
  const base = fallback("owgr");
  const html = await text("https://www.owgr.com/sharing-widget?pageSize=10&text=WORLD%27S+TOP+10", TTL.golf);
  if (!html) return base;
  const rows = owgrRows(html);
  return topValid(rows) ? { ...base, rows, asOf: nowLabel(), sourceLabel: "OWGR — widget oficial", sourceUrl: "https://www.owgr.com/current-world-ranking", isFallback: false } : base;
}

async function rolex() {
  const base = fallback("rolex");
  const html = await text("https://www.rolexrankings.com/rankings", TTL.golf);
  if (!html) return base;
  const rows = rolexRows(html);
  return topValid(rows) ? { ...base, rows, asOf: nowLabel(), sourceLabel: "Rolex Rankings — ranking oficial", isFallback: false } : base;
}

async function surfPair() {
  const menBase = fallback("wslMen");
  const womenBase = fallback("wslWomen");
  const html = await text("https://previsaodosurf.com.br/competicoes", TTL.surf);
  if (!html) return { wslMen: menBase, wslWomen: womenBase };
  const pageText = clean(html);
  const menRows = surfRows(pageText, "WSL Championship Tour Masculino 2026", "wslMen");
  const womenRows = surfRows(pageText, "WSL Championship Tour Feminino 2026", "wslWomen");
  const asOf = nowLabel("espelho do ranking WSL consultado");
  return {
    wslMen: topValid(menRows) ? { ...menBase, rows: menRows, asOf, sourceLabel: "WSL — atualização automática", isFallback: false } : menBase,
    wslWomen: topValid(womenRows) ? { ...womenBase, rows: womenRows, asOf, sourceLabel: "WSL — atualização automática", isFallback: false } : womenBase,
  };
}

export async function refreshRanking(key: RankingKey): Promise<RefreshedRanking> {
  if (key === "atp") return atp();
  if (key === "wta") return wta();
  if (key === "owgr") return owgr();
  if (key === "rolex") return rolex();
  const surf = await surfPair();
  return key === "wslMen" ? surf.wslMen : surf.wslWomen;
}
