import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_PATH = path.join(process.cwd(), "content", "newsroom", "articles.json");
const SITE_URL = process.env.LAP_SITE_URL || "https://lap-live-sports.vercel.app";
const LOOKBACK_MS = 36 * 60 * 60 * 1000;
const MAX_NEW_ARTICLES = 4;
const MAX_STORED_ARTICLES = 300;

const LABELS = {
  futebol: "Futebol",
  "futebol-americano": "NFL",
  basquete: "NBA",
  beisebol: "MLB",
};

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length >= 4));
}

function similar(a, b) {
  const left = tokens(a); const right = tokens(b); if (!left.size || !right.size) return false;
  let shared = 0; for (const token of left) if (right.has(token)) shared += 1;
  return shared / new Set([...left, ...right]).size >= 0.5;
}

function slugify(value) {
  return normalize(value).replace(/\s+/g, "-").slice(0, 82) || "materia-lap";
}

function humanizeLeague(value) {
  return String(value || "").replace(/regular-season/gi, "temporada regular").replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(date);
}

function matchContext(event) {
  const parts = [];
  const date = formatDate(event.startTime);
  if (date) parts.push(`disputado em ${date}`);
  if (event.venue) parts.push(`no ${event.venue}`);
  return parts.length ? `, ${parts.join(" ")}` : "";
}

function footballCopy({ home, away, homeScore, awayScore, league, event }) {
  const context = matchContext(event);
  if (homeScore === awayScore) {
    const title = `${home} e ${away} ficam no ${homeScore} a ${awayScore} pelo ${league}`;
    const summary = `${home} e ${away} encerraram o confronto pelo ${league} sem vencedor. O empate por ${homeScore} a ${awayScore} deixou as duas equipes sem conseguir abrir vantagem no placar.`;
    const content = [
      `${home} e ${away} ficaram no ${homeScore} a ${awayScore} pelo ${league}${context}. O duelo terminou sem gols e sem vencedor, em um resultado que mantém o equilíbrio do confronto também no placar final.`,
      `O ${homeScore} a ${awayScore} resume uma partida em que nenhuma das equipes conseguiu transformar o jogo em vantagem no marcador. Sem gols, cada tentativa de mudar o rumo do confronto ganhou ainda mais peso, mas o resultado permaneceu inalterado até o encerramento.`,
      `Para ${home} e ${away}, o empate passa a fazer parte da caminhada no ${league}. Em uma competição de sequência longa, resultados assim ganham significado quando colocados ao lado do desempenho das rodadas anteriores e dos compromissos que vêm pela frente.`,
      `Mais do que olhar apenas para o placar, o próximo passo é entender como cada equipe reage depois de um jogo sem vencedor. A capacidade de transformar equilíbrio em vitória nos próximos compromissos pode fazer diferença na construção da campanha.`,
      `A LAP acompanha a sequência de ${home} e ${away} e atualiza a cobertura da modalidade conforme novos resultados e informações confirmadas ficam disponíveis.`,
    ].join("\n\n");
    return { title, summary, content };
  }

  const winner = homeScore > awayScore ? home : away;
  const loser = homeScore > awayScore ? away : home;
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const margin = winnerScore - loserScore;
  const title = `${winner} supera ${loser} por ${winnerScore} a ${loserScore} pelo ${league}`;
  const summary = `${winner} venceu ${loser} por ${winnerScore} a ${loserScore} pelo ${league}. A diferença de ${margin} ${margin === 1 ? "gol" : "gols"} definiu o resultado do confronto.`;
  const content = [
    `${winner} levou a melhor sobre ${loser} e venceu por ${winnerScore} a ${loserScore} pelo ${league}${context}. O resultado colocou o vencedor à frente por uma diferença de ${margin} ${margin === 1 ? "gol" : "gols"} no placar final.`,
    `Em jogos decididos por margem curta, cada lance capaz de alterar o marcador ganha importância. Desta vez, ${winner} conseguiu construir a vantagem necessária para sair com a vitória, enquanto ${loser} terminou o confronto sem conseguir igualar o resultado.`,
    `O triunfo passa agora a compor a campanha de ${winner} no ${league}. Para ${loser}, o placar vira referência para os ajustes antes do próximo compromisso, em uma sequência na qual cada resultado ajuda a definir o rumo da temporada.`,
    `A leitura do jogo não termina no apito final: a resposta das equipes nas próximas partidas mostrará o peso real deste resultado dentro da competição. O desafio para o vencedor é dar continuidade ao momento; para o derrotado, reagir rapidamente.`,
    `A LAP acompanha os próximos compromissos das equipes e atualiza a cobertura conforme novos resultados e informações confirmadas ficam disponíveis.`,
  ].join("\n\n");
  return { title, summary, content };
}

function baseballCopy({ home, away, homeScore, awayScore, league, event }) {
  const context = matchContext(event);
  const winner = homeScore > awayScore ? home : away;
  const loser = homeScore > awayScore ? away : home;
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const margin = winnerScore - loserScore;
  const title = `${winner} vence ${loser} por ${winnerScore} a ${loserScore} na ${league}`;
  const summary = `${winner} derrotou ${loser} por ${winnerScore} a ${loserScore} na ${league}. A partida terminou com diferença de ${margin} ${margin === 1 ? "corrida" : "corridas"} entre as equipes.`;
  const content = [
    `${winner} venceu ${loser} por ${winnerScore} a ${loserScore} na ${league}${context}. O placar final mostrou uma diferença de ${margin} ${margin === 1 ? "corrida" : "corridas"}, margem que decidiu o confronto entre as equipes.`,
    `No beisebol, partidas com vantagem curta mantêm o resultado em aberto por boa parte do caminho. Quando a diferença é pequena, cada corrida adicionada ao placar pode mudar completamente a pressão sobre ataque e defesa — e foi essa margem que separou vencedor e derrotado no resultado final.`,
    `Para ${winner}, a vitória entra na conta de uma temporada construída jogo a jogo. ${loser}, por outro lado, deixa o confronto com uma derrota que também passa a integrar a longa sequência da ${league}, na qual consistência ao longo do calendário é fundamental.`,
    `O resultado isolado conta uma parte da história; a sequência dos próximos jogos dirá quanto esta vitória pode representar para ${winner} e como ${loser} responderá depois do revés. Em um calendário extenso, a capacidade de acumular bons resultados e reagir rapidamente às derrotas costuma separar campanhas regulares de campanhas mais competitivas.`,
    `A LAP segue acompanhando a temporada e atualiza a cobertura de MLB com novos resultados, classificação e informações confirmadas ao longo do calendário.`,
  ].join("\n\n");
  return { title, summary, content };
}

function genericCopy({ home, away, homeScore, awayScore, league, label, event }) {
  const context = matchContext(event);
  const tied = homeScore === awayScore;
  const winner = tied ? null : homeScore > awayScore ? home : away;
  const loser = tied ? null : homeScore > awayScore ? away : home;
  const winnerScore = Math.max(homeScore, awayScore);
  const loserScore = Math.min(homeScore, awayScore);
  const title = tied ? `${home} e ${away} empatam por ${homeScore} a ${awayScore} em ${league}` : `${winner} vence ${loser} por ${winnerScore} a ${loserScore} em ${league}`;
  const summary = tied ? `${home} e ${away} terminaram empatados por ${homeScore} a ${awayScore} em ${league}.` : `${winner} superou ${loser} por ${winnerScore} a ${loserScore} em ${league}.`;
  const content = [
    `${summary}${context}.`,
    `O resultado encerra mais um capítulo da temporada de ${label}, com o placar final servindo como ponto de partida para a leitura dos próximos compromissos das equipes.`,
    `A sequência do calendário mostrará o impacto deste confronto para os envolvidos e como cada lado responderá no próximo desafio.`,
    `A LAP acompanha a competição e atualiza a cobertura conforme novos dados e informações confirmadas ficam disponíveis.`,
  ].join("\n\n");
  return { title, summary, content };
}

async function loadExisting() {
  try { const parsed = JSON.parse(await readFile(CONTENT_PATH, "utf8")); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
}

async function loadPayload() {
  const response = await fetch(`${SITE_URL}/api/live?refresh=1`, { headers: { "user-agent": "LAP Newsroom Data Stories/2.0" } });
  if (!response.ok) throw new Error(`API LAP respondeu ${response.status}`);
  return response.json();
}

function isSupportedFeed(feed) {
  return Object.prototype.hasOwnProperty.call(LABELS, feed.id);
}

function isNFL(feed, event) {
  return feed.id !== "futebol-americano" || /nfl/i.test(`${event.league || ""} ${event.round || ""}`);
}

function buildStory(feed, event) {
  const homeScore = Number(event.home?.score);
  const awayScore = Number(event.away?.score);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore) || !event.home?.name || !event.away?.name) return null;

  const home = String(event.home.name);
  const away = String(event.away.name);
  const league = humanizeLeague(event.league || LABELS[feed.id]);
  const label = LABELS[feed.id];
  const copyArgs = { home, away, homeScore, awayScore, league, label, event };
  const editorial = feed.id === "futebol"
    ? footballCopy(copyArgs)
    : feed.id === "beisebol"
      ? baseballCopy(copyArgs)
      : genericCopy(copyArgs);

  const { title, summary, content } = editorial;
  const digest = createHash("sha1").update(`${feed.id}|${event.id}|${title}`).digest("hex").slice(0, 12);
  const stamp = new Date().toISOString();

  return {
    id: `newsroom-data-${digest}`,
    slug: `${slugify(title)}-${digest.slice(0, 6)}`,
    sportId: feed.id,
    title,
    summary,
    content,
    sourceName: "LAP Dados",
    sourceUrl: `${SITE_URL}/modalidades/${feed.id}`,
    coverImageUrl: null,
    authorName: "Redação LAP",
    authorRole: `Newsroom AI · ${label}`,
    tags: [slugify(label), "resultado", slugify(league)],
    seoTitle: title.slice(0, 70),
    seoDescription: summary.slice(0, 170),
    status: "published",
    scheduledAt: null,
    publishedAt: stamp,
    createdAt: stamp,
    updatedAt: stamp,
    homepagePriority: 62,
    breaking: false,
    agentId: feed.id,
    sourceUrls: [`${SITE_URL}/modalidades/${feed.id}`],
    verifiedFacts: 2,
    dataDriven: true,
  };
}

async function main() {
  const [existing, payload] = await Promise.all([loadExisting(), loadPayload()]);
  const now = Date.now();
  const stories = [];

  for (const feed of Array.isArray(payload?.feeds) ? payload.feeds : []) {
    if (!isSupportedFeed(feed)) continue;
    const completed = (Array.isArray(feed.scores) ? feed.scores : [])
      .filter((event) => event.state === "post" && event.startTime && now - new Date(event.startTime).getTime() <= LOOKBACK_MS && isNFL(feed, event))
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

    for (const event of completed) {
      const story = buildStory(feed, event);
      if (!story || [...existing, ...stories].some((article) => similar(article.title || "", story.title))) continue;
      stories.push(story);
      break;
    }
    if (stories.length >= MAX_NEW_ARTICLES) break;
  }

  if (!stories.length) {
    console.log("Nenhum resultado novo elegível para matéria própria nesta rodada.");
    return;
  }

  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const next = [...stories, ...existing]
    .filter((article) => !article.publishedAt || new Date(article.publishedAt).getTime() >= cutoff)
    .slice(0, MAX_STORED_ARTICLES);

  await writeFile(CONTENT_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  console.log(`Publicadas ${stories.length} matérias autorais baseadas em dados: ${stories.map((story) => story.title).join(" | ")}`);
}

main().catch((error) => {
  console.error("Falha ao produzir matérias de dados da LAP:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});