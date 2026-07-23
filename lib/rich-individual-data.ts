import officialRankingsPayload from "@/content/rankings/official-rankings.json";
import { getCachedLivePayload } from "@/lib/free-live-data";
import type { NewsItem, SportId } from "@/lib/live-data";

export type RichMetric = { label: string; value: string; detail: string };
export type RichTable = {
  title: string;
  description: string;
  columns: string[];
  rows: string[][];
  limit?: number;
  sourceLabel?: string;
  sourceUrl?: string;
  asOf?: string;
};
export type RichResult = { title: string; subtitle: string; date: string | null; rows: Array<{ label: string; value: string; detail?: string }> };
export type RichSpotlight = { eyebrow: string; title: string; text: string; value?: string };

export type RichIndividualHub = {
  sportId: SportId;
  eyebrow: string;
  title: string;
  subtitle: string;
  metrics: RichMetric[];
  tables: RichTable[];
  results: RichResult[];
  spotlights: RichSpotlight[];
  news: NewsItem[];
  sources: string[];
  generatedAt: string;
};

type AnyRecord = Record<string, unknown>;
type OfficialRankingKey = keyof typeof officialRankingsPayload;

const JOLPICA = "https://api.jolpi.ca/ergast/f1";
const ESPN_SITE = "https://site.api.espn.com/apis/site/v2/sports";

function rec(value: unknown): AnyRecord { return value && typeof value === "object" ? value as AnyRecord : {}; }
function arr<T = unknown>(value: unknown): T[] { return Array.isArray(value) ? value as T[] : []; }
function txt(value: unknown, fallback: string | number = "") { return typeof value === "string" || typeof value === "number" ? String(value) : String(fallback); }
function nullable(value: unknown) { const valueText = txt(value).trim(); return valueText || null; }
function cleanText(value: string) { return value.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, " ").trim(); }

async function safeJson(url: string, revalidate = 1800): Promise<unknown | null> {
  try { const response = await fetch(url, { next: { revalidate }, headers: { "user-agent": "LAP Live Sports/6.0" } }); return response.ok ? await response.json() : null; } catch { return null; }
}
async function safeText(url: string, revalidate = 3600): Promise<string | null> {
  try { const response = await fetch(url, { next: { revalidate }, headers: { "user-agent": "Mozilla/5.0 LAP Live Sports" } }); return response.ok ? await response.text() : null; } catch { return null; }
}

function officialRanking(key: OfficialRankingKey) {
  const ranking = officialRankingsPayload[key];
  return {
    title: ranking.title,
    asOf: ranking.asOf,
    sourceLabel: ranking.sourceLabel,
    sourceUrl: ranking.sourceUrl,
    columns: [...ranking.columns],
    rows: ranking.rows.map((row) => row.map(String)),
  };
}

async function sportNews(sportId: SportId) {
  const payload = await getCachedLivePayload().catch(() => null);
  const feed = payload?.feeds.find((item) => item.id === sportId);
  const items = [...(payload?.editorial ?? []).filter((item) => item.sportId === sportId), ...(feed?.news ?? [])];
  return Array.from(new Map(items.map((item) => [item.slug || item.id, item])).values()).sort((a, b) => (b.publishedAt ? new Date(b.publishedAt).getTime() : 0) - (a.publishedAt ? new Date(a.publishedAt).getTime() : 0)).slice(0, 12);
}

function f1Name(driver: AnyRecord) { return [txt(driver.givenName), txt(driver.familyName)].filter(Boolean).join(" ") || txt(driver.driverId, "Piloto"); }
function f1Constructor(value: AnyRecord) { return txt(value.name, txt(value.constructorId, "Equipe")); }

async function loadF1(): Promise<RichIndividualHub> {
  const year = new Date().getUTCFullYear();
  const [driversJson, constructorsJson, resultsJson, racesJson, pitJson, news] = await Promise.all([
    safeJson(`${JOLPICA}/${year}/driverstandings/?limit=100`, 900),
    safeJson(`${JOLPICA}/${year}/constructorstandings/?limit=100`, 900),
    safeJson(`${JOLPICA}/${year}/results/?limit=1000`, 900),
    safeJson(`${JOLPICA}/${year}/races/?limit=100`, 3600),
    safeJson(`https://api.openf1.org/v1/pit?date>=${year}-01-01&stop_duration>0`, 1800),
    sportNews("formula1"),
  ]);
  const driverList = arr<AnyRecord>(rec(rec(rec(driversJson).MRData).StandingsTable).StandingsLists)[0];
  const driverStandings = arr<AnyRecord>(rec(driverList).DriverStandings);
  const constructorList = arr<AnyRecord>(rec(rec(rec(constructorsJson).MRData).StandingsTable).StandingsLists)[0];
  const constructorStandings = arr<AnyRecord>(rec(constructorList).ConstructorStandings);
  const resultRaces = arr<AnyRecord>(rec(rec(rec(resultsJson).MRData).RaceTable).Races);
  const scheduleRaces = arr<AnyRecord>(rec(rec(rec(racesJson).MRData).RaceTable).Races);
  const now = Date.now();
  const upcomingRaces = scheduleRaces.filter((race) => { const time = new Date(`${txt(race.date)}T${txt(race.time, "00:00:00Z")}`).getTime(); return Number.isFinite(time) && time >= now; }).slice(0, 6);
  const completedRaces = resultRaces.filter((race) => arr(race.Results).length).sort((a, b) => Number(txt(b.round)) - Number(txt(a.round)));
  const fastest = new Map<string, number>();
  const retirements = new Map<string, number>();
  const driverTeam = new Map<number, string>();
  for (const race of completedRaces) for (const result of arr<AnyRecord>(race.Results)) {
    const driver = rec(result.Driver); const constructor = rec(result.Constructor); const name = f1Name(driver); const number = Number(txt(driver.permanentNumber));
    if (Number.isFinite(number)) driverTeam.set(number, f1Constructor(constructor));
    if (txt(rec(result.FastestLap).rank) === "1") fastest.set(name, (fastest.get(name) ?? 0) + 1);
    const status = txt(result.status);
    if (status && status !== "Finished" && !/^\+\d+\s+Laps?$/i.test(status)) retirements.set(name, (retirements.get(name) ?? 0) + 1);
  }
  const pitRows = arr<AnyRecord>(pitJson).filter((item) => Number(item.stop_duration) > 0);
  const fastestPit = pitRows.sort((a, b) => Number(a.stop_duration) - Number(b.stop_duration))[0];
  const fastestPitTeam = fastestPit ? driverTeam.get(Number(fastestPit.driver_number)) ?? `Carro #${txt(fastestPit.driver_number)}` : null;
  const fastestLapLeader = [...fastest.entries()].sort((a, b) => b[1] - a[1])[0];
  const retirementLeader = [...retirements.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    sportId: "formula1", eyebrow: "Fórmula 1", title: `Temporada ${year} da F1`, subtitle: "Classificação de pilotos e construtores, calendário, últimos resultados e indicadores de corrida calculados com dados reais.",
    metrics: [
      { label: "Líder do Mundial", value: f1Name(rec(driverStandings[0]?.Driver)) || "—", detail: driverStandings[0] ? `${txt(driverStandings[0].points)} pontos` : "Classificação em atualização" },
      { label: "Líder de construtores", value: f1Constructor(rec(constructorStandings[0]?.Constructor)) || "—", detail: constructorStandings[0] ? `${txt(constructorStandings[0].points)} pontos` : "Classificação em atualização" },
      { label: "Mais voltas rápidas", value: fastestLapLeader?.[0] || "—", detail: fastestLapLeader ? `${fastestLapLeader[1]} corridas com volta mais rápida` : "Dados em atualização" },
      { label: "Mais abandonos", value: retirementLeader?.[0] || "—", detail: retirementLeader ? `${retirementLeader[1]} abandonos/status não concluído` : "Dados em atualização" },
      { label: "Pit stop mais rápido", value: fastestPitTeam || "—", detail: fastestPit ? `${Number(fastestPit.stop_duration).toFixed(2)}s de parada` : "OpenF1 não retornou uma parada válida" },
    ],
    tables: [
      { title: "Mundial de Pilotos", description: "Classificação atual do campeonato.", columns: ["Pos.", "Piloto", "Equipe", "Pontos", "Vitórias"], rows: driverStandings.map((item) => [txt(item.position), f1Name(rec(item.Driver)), arr<AnyRecord>(item.Constructors).map(f1Constructor).join(" / "), txt(item.points), txt(item.wins)]), limit: 24 },
      { title: "Mundial de Construtores", description: "Classificação atual das equipes.", columns: ["Pos.", "Equipe", "Pontos", "Vitórias"], rows: constructorStandings.map((item) => [txt(item.position), f1Constructor(rec(item.Constructor)), txt(item.points), txt(item.wins)]), limit: 12 },
      { title: "Próximos GPs", description: "Calendário restante publicado para a temporada.", columns: ["Etapa", "GP", "Circuito", "Data"], rows: upcomingRaces.map((race) => [txt(race.round), txt(race.raceName), txt(rec(race.Circuit).circuitName), txt(race.date)]), limit: 8 },
      { title: "Indicadores da temporada", description: "Contagem derivada dos resultados oficiais retornados.", columns: ["Piloto", "Voltas mais rápidas", "Abandonos"], rows: Array.from(new Set([...fastest.keys(), ...retirements.keys()])).map((name) => [name, String(fastest.get(name) ?? 0), String(retirements.get(name) ?? 0)]).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, 20) },
    ],
    results: completedRaces.slice(0, 6).map((race) => ({ title: txt(race.raceName), subtitle: txt(rec(race.Circuit).circuitName), date: nullable(race.date), rows: arr<AnyRecord>(race.Results).slice(0, 10).map((result) => ({ label: `${txt(result.position)}º · ${f1Name(rec(result.Driver))}`, value: f1Constructor(rec(result.Constructor)), detail: txt(result.status) })) })),
    spotlights: [{ eyebrow: "Dados de pit lane", title: "Parada estacionária mais rápida encontrada", text: "O indicador usa o campo stop_duration do OpenF1, disponível para dados históricos recentes. Não usa o tempo total atravessando o pit lane.", value: fastestPit ? `${fastestPitTeam} · ${Number(fastestPit.stop_duration).toFixed(2)}s` : "Aguardando dado disponível" }],
    news, sources: ["Jolpica F1 (classificações, calendário e resultados)", "OpenF1 (pit stops)", "LAP/feeds editoriais para notícias"], generatedAt: new Date().toISOString(),
  };
}

function parseTennisFinals(json: unknown, tour: string): RichResult[] {
  const events = arr<AnyRecord>(rec(json).events);
  return events.flatMap((event) => {
    const competitions = arr<AnyRecord>(event.competitions);
    const finals = competitions.filter((competition) => {
      const status = txt(rec(rec(competition.status).type).state);
      const roundText = `${txt(competition.type)} ${txt(competition.round)} ${txt(rec(competition.round).displayName)} ${txt(rec(competition.notes).headline)}`.toLowerCase();
      return status === "post" && /final/.test(roundText);
    });
    return finals.flatMap((competition) => {
      const competitors = arr<AnyRecord>(competition.competitors);
      const winner = competitors.find((item) => item.winner === true);
      const loser = competitors.find((item) => item.winner === false);
      if (!winner) return [];
      const winnerAthlete = rec(winner.athlete || winner.team);
      const loserAthlete = rec(loser?.athlete || loser?.team);
      return [{ title: txt(event.name, txt(event.shortName, "Torneio")), subtitle: tour, date: nullable(event.date), rows: [{ label: "Campeão", value: txt(winnerAthlete.displayName, txt(winnerAthlete.fullName, "Vencedor")), detail: loser ? `Final contra ${txt(loserAthlete.displayName, txt(loserAthlete.fullName))}` : undefined }] } satisfies RichResult];
    });
  });
}

async function loadTennis(): Promise<RichIndividualHub> {
  const year = new Date().getUTCFullYear();
  const from = new Date(Date.now() - 100 * 86_400_000).toISOString().slice(0, 10).replace(/-/g, "");
  const to = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const atp = officialRanking("atp");
  const wta = officialRanking("wta");
  const [atpScores, wtaScores, news] = await Promise.all([
    safeJson(`${ESPN_SITE}/tennis/atp/scoreboard?limit=500&dates=${from}-${to}`, 1800),
    safeJson(`${ESPN_SITE}/tennis/wta/scoreboard?limit=500&dates=${from}-${to}`, 1800),
    sportNews("tenis"),
  ]);
  const finals = [...parseTennisFinals(atpScores, "ATP"), ...parseTennisFinals(wtaScores, "WTA")].sort((a, b) => (b.date ? new Date(b.date).getTime() : 0) - (a.date ? new Date(a.date).getTime() : 0));
  const grandSlams: RichTable = { title: "Maiores campeões de Grand Slam", description: "Recordes históricos de simples; contagem de títulos de majors.", columns: ["Circuito", "Jogador(a)", "Títulos"], rows: [["Masculino", "Novak Djokovic", "24"], ["Masculino", "Rafael Nadal", "22"], ["Masculino", "Roger Federer", "20"], ["Feminino", "Margaret Court", "24"], ["Feminino", "Serena Williams", "23"], ["Feminino", "Steffi Graf", "22"]] };
  return {
    sportId: "tenis", eyebrow: "Tênis mundial", title: `ATP e WTA ${year}`, subtitle: "Rankings oficiais de simples, campeões recentes, Grand Slams e notícias dos principais circuitos.",
    metrics: [
      { label: "Nº 1 ATP", value: atp.rows[0]?.[1] || "—", detail: atp.rows[0]?.[2] ? `${atp.rows[0][2]} pontos` : "Ranking oficial" },
      { label: "Nº 1 WTA", value: wta.rows[0]?.[1] || "—", detail: wta.rows[0]?.[3] ? `${wta.rows[0][3]} pontos` : "Ranking oficial" },
      { label: "Top oficial exibido", value: String(atp.rows.length + wta.rows.length), detail: "ATP + WTA, sem estimativa" },
      { label: "Finais recentes", value: String(finals.length), detail: "Finais identificadas no período recente" },
    ],
    tables: [
      { title: atp.title, description: "Top 10 da classificação oficial de simples da ATP.", columns: atp.columns, rows: atp.rows, limit: 10, sourceLabel: atp.sourceLabel, sourceUrl: atp.sourceUrl, asOf: atp.asOf },
      { title: wta.title, description: "Top 10 da classificação oficial de simples da WTA.", columns: wta.columns, rows: wta.rows, limit: 10, sourceLabel: wta.sourceLabel, sourceUrl: wta.sourceUrl, asOf: wta.asOf },
      grandSlams,
    ],
    results: finals.slice(0, 10),
    spotlights: [{ eyebrow: "Ranking oficial", title: "ATP e WTA separados", text: "A LAP exibe as duas classificações oficiais de simples em blocos independentes, com data de referência e link direto para a fonte. Assim o ranking não desaparece quando um agregador externo falha." }, { eyebrow: "Grand Slam", title: "Quatro majors por temporada", text: "Australian Open, Roland Garros, Wimbledon e US Open formam o núcleo histórico do calendário. A central destaca os recordistas sem estimar números de premiação não publicados pela fonte." }],
    news, sources: ["ATP Tour — PIF ATP Rankings", "WTA Tennis — PIF WTA Rankings", "ESPN Site API apenas para resultados recentes"], generatedAt: new Date().toISOString(),
  };
}

function parseRowsFromHtml(html: string) {
  return (html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []).map((row) => (row.match(/<t[dh][^>]*>[\s\S]*?<\/t[dh]>/gi) ?? []).map(cleanText).filter(Boolean)).filter((cells) => cells.length >= 2);
}

async function loadTour(): Promise<RichIndividualHub> {
  const year = new Date().getUTCFullYear();
  const [homeHtml, rankingsHtml, news] = await Promise.all([safeText("https://www.letour.fr/en/", 600), safeText("https://www.letour.fr/en/rankings", 600), sportNews("ciclismo")]);
  const homepageText = homeHtml ? cleanText(homeHtml) : "";
  const stageRowsRaw = rankingsHtml ? parseRowsFromHtml(rankingsHtml) : [];
  const stageRows = stageRowsRaw.filter((cells) => /^\d+$/.test(cells[0] || "") && cells.length >= 4).slice(0, 30).map((cells) => [cells[0], cells[1], cells[2], cells[3], cells[4] || "-"]);
  const gcMatch = homepageText.match(/General classification[\s\S]{0,5000}/i)?.[0] || homepageText.match(/Classement général[\s\S]{0,5000}/i)?.[0] || "";
  const gcRows: string[][] = [];
  const gcRegex = /(\d{1,3})\s+([A-ZÀ-Ý][A-ZÀ-Ý' .-]{3,})\s+([A-Z][A-Z0-9| .&'-]{3,})\s+((?:\d{1,3}h\s*)?\d{1,2}'\s*\d{1,2}''|\+\s*\d{2}h\s*\d{2}'\s*\d{2}'')/g;
  let match: RegExpExecArray | null;
  while ((match = gcRegex.exec(gcMatch)) && gcRows.length < 20) gcRows.push([match[1], match[2].trim(), match[3].trim(), match[4].trim()]);
  const yellow = gcRows[0]?.[1] || "—";
  return {
    sportId: "ciclismo", eyebrow: "Tour de France", title: `Tour de France ${year}`, subtitle: "A LAP concentra o Tour: classificação geral, resultado da etapa mais recente, equipes, camisas e notícias da corrida.",
    metrics: [{ label: "Camisa amarela", value: yellow, detail: gcRows[0]?.[2] || "Classificação geral em atualização" }, { label: "Top GC carregado", value: String(gcRows.length), detail: "Posições extraídas da publicação oficial" }, { label: "Resultado de etapa", value: String(stageRows.length), detail: "Ciclistas retornados na classificação oficial atual" }, { label: "Fonte principal", value: "Le Tour", detail: "Site oficial da prova" }],
    tables: [{ title: "Classificação geral", description: "General Classification publicada no site oficial do Tour.", columns: ["Pos.", "Ciclista", "Equipe", "Tempo / diferença"], rows: gcRows, limit: 20 }, { title: "Última etapa publicada", description: "Resultado da etapa selecionada pelo site oficial no momento da atualização.", columns: ["Pos.", "Ciclista", "Equipe", "Tempo", "Gap"], rows: stageRows, limit: 30 }],
    results: stageRows.slice(0, 10).length ? [{ title: "Top 10 da etapa publicada", subtitle: "Tour de France", date: null, rows: stageRows.slice(0, 10).map((row) => ({ label: `${row[0]}º · ${row[1]}`, value: row[2], detail: row[3] })) }] : [],
    spotlights: [{ eyebrow: "Camisas", title: "Amarela, verde, bolinhas e branca", text: "A camisa amarela lidera o tempo geral; a verde premia pontos; a de bolinhas lidera montanha; a branca destaca o melhor jovem. A LAP só atribui o nome do portador quando ele é retornado de forma confiável pela fonte oficial.", value: yellow !== "—" ? `Amarela: ${yellow}` : undefined }, { eyebrow: "Cobertura", title: "Foco exclusivo no Tour de France", text: "A área de ciclismo deixa de ser genérica e passa a acompanhar a principal volta francesa, com classificação e etapas durante a competição." }],
    news, sources: ["letour.fr (classificações e etapas)", "LAP/feeds editoriais para notícias"], generatedAt: new Date().toISOString(),
  };
}

async function loadGolf(): Promise<RichIndividualHub> {
  const year = new Date().getUTCFullYear();
  const owgr = officialRanking("owgr");
  const rolex = officialRanking("rolex");
  const [scoreboard, news] = await Promise.all([safeJson(`${ESPN_SITE}/golf/pga/scoreboard?limit=100&dates=${year}`, 1800), sportNews("golfe")]);
  const events = arr<AnyRecord>(rec(scoreboard).events);
  const completed = events.filter((event) => txt(rec(rec(event.status).type).state) === "post").sort((a, b) => new Date(txt(b.date)).getTime() - new Date(txt(a.date)).getTime());
  const recent = completed.slice(0, 8).map((event) => {
    const competition = arr<AnyRecord>(event.competitions)[0] || {};
    const competitors = arr<AnyRecord>(competition.competitors).sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999));
    return { title: txt(event.name, "Torneio"), subtitle: txt(rec(event.season).slug, "PGA Tour"), date: nullable(event.date), rows: competitors.slice(0, 10).map((item, index) => { const athlete = rec(item.athlete); return { label: `${txt(item.order, index + 1)}º · ${txt(athlete.displayName, txt(athlete.fullName, "Golfista"))}`, value: txt(item.score, txt(item.status, "")), detail: nullable(item.winnings) || nullable(item.earnings) || undefined }; }) } satisfies RichResult;
  });
  return {
    sportId: "golfe", eyebrow: "Golfe", title: `Golfe mundial ${year}`, subtitle: "Rankings mundiais oficiais masculino e feminino, torneios recentes, leaderboards e notícias.",
    metrics: [
      { label: "Nº 1 mundial", value: owgr.rows[0]?.[1] || "—", detail: "OWGR masculino" },
      { label: "Nº 1 mundial feminino", value: rolex.rows[0]?.[1] || "—", detail: "Rolex Women's World Golf Rankings" },
      { label: "Top oficial exibido", value: String(owgr.rows.length + rolex.rows.length), detail: "10 homens + 10 mulheres" },
      { label: "Torneios recentes", value: String(recent.length), detail: "Eventos concluídos retornados" },
    ],
    tables: [
      { title: owgr.title, description: "Top 10 do Official World Golf Ranking.", columns: owgr.columns, rows: owgr.rows, limit: 10, sourceLabel: owgr.sourceLabel, sourceUrl: owgr.sourceUrl, asOf: owgr.asOf },
      { title: rolex.title, description: "Top 10 do ranking mundial feminino oficial reconhecido no golfe profissional.", columns: rolex.columns, rows: rolex.rows, limit: 10, sourceLabel: rolex.sourceLabel, sourceUrl: rolex.sourceUrl, asOf: rolex.asOf },
    ],
    results: recent,
    spotlights: [{ eyebrow: "Ranking mundial", title: "OWGR + Rolex Rankings", text: "A central não mistura FedExCup com ranking mundial. O OWGR representa o ranking mundial masculino; o Rolex Rankings, o feminino. A data de referência e o link oficial ficam visíveis em cada tabela." }, { eyebrow: "Dinheiro", title: "Premiação sem estimativa", text: "Quando o leaderboard publica winnings/earnings, o valor aparece junto ao resultado. A LAP não converte bolsa total em ganho individual por aproximação." }],
    news, sources: ["Official World Golf Ranking (OWGR)", "Rolex Women's World Golf Rankings", "ESPN Site API apenas para torneios e leaderboards"], generatedAt: new Date().toISOString(),
  };
}

const BRAZILIAN_STORM_2026 = ["Yago Dora", "Filipe Toledo", "Gabriel Medina", "Italo Ferreira", "João Chianca", "Miguel Pupo", "Samuel Pupo", "Alejo Muniz", "Mateus Herdy", "Luana Silva"];

async function loadSurf(): Promise<RichIndividualHub> {
  const year = new Date().getUTCFullYear();
  const men = officialRanking("wslMen");
  const women = officialRanking("wslWomen");
  const news = await sportNews("surfe");
  const brazilRows = BRAZILIAN_STORM_2026.map((name, index) => [String(index + 1), name, name === "Luana Silva" ? "Feminino" : "Masculino", "Brasil"]);
  return {
    sportId: "surfe", eyebrow: "World Surf League", title: `Championship Tour ${year}`, subtitle: "Ranking do Championship Tour masculino e feminino, Brazilian Storm e notícias da elite mundial.",
    metrics: [
      { label: "Líder masculino", value: men.rows[0]?.[1] || "—", detail: men.rows[0]?.[3] ? `${men.rows[0][3]} pontos` : "WSL Championship Tour" },
      { label: "Líder feminino", value: women.rows[0]?.[1] || "—", detail: women.rows[0]?.[3] ? `${women.rows[0][3]} pontos` : "WSL Championship Tour" },
      { label: "Brasileiros no Top 5", value: String([...men.rows, ...women.rows].filter((row) => row[2] === "BRA").length), detail: "Somando os dois rankings exibidos" },
      { label: "Formato 2026", value: "Pontos corridos", detail: "Temporada definida pelo ranking acumulado" },
    ],
    tables: [
      { title: men.title, description: "Classificação do Championship Tour masculino. A WSL é a fonte canônica; o snapshot evita que o bloco suma quando o site oficial bloqueia leitura automatizada.", columns: men.columns, rows: men.rows, limit: 5, sourceLabel: men.sourceLabel, sourceUrl: men.sourceUrl, asOf: men.asOf },
      { title: women.title, description: "Classificação do Championship Tour feminino. A WSL é a fonte canônica; o snapshot é mantido com data explícita de referência.", columns: women.columns, rows: women.rows, limit: 5, sourceLabel: women.sourceLabel, sourceUrl: women.sourceUrl, asOf: women.asOf },
      { title: "Brazilian Storm 2026", description: "Brasileiros identificados na elite do Championship Tour de 2026, incluindo a representação feminina.", columns: ["#", "Surfista", "Categoria", "País"], rows: brazilRows, limit: 20 },
    ],
    results: [],
    spotlights: [{ eyebrow: "Ranking oficial", title: "WSL masculina e feminina separadas", text: "A LAP mantém um snapshot verificado da classificação e aponta diretamente para o leaderboard oficial da WSL. Isso evita tabela vazia sem substituir o ranking por uma estimativa." }, { eyebrow: "Brazilian Storm", title: "Brasil no centro da disputa", text: "A página prioriza a temporada dos brasileiros, resultados, mudanças no ranking e desempenho nas etapas do Championship Tour." }],
    news, sources: ["World Surf League — Championship Tour rankings", "Snapshot verificado pós-VIVO Rio Pro", "LAP/feeds editoriais"], generatedAt: new Date().toISOString(),
  };
}

export async function getRichIndividualHub(sportId: SportId): Promise<RichIndividualHub | null> {
  if (sportId === "formula1") return loadF1();
  if (sportId === "tenis") return loadTennis();
  if (sportId === "ciclismo") return loadTour();
  if (sportId === "golfe") return loadGolf();
  if (sportId === "surfe") return loadSurf();
  return null;
}
