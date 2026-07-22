import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const CONTENT_PATH = path.join(process.cwd(), "content", "newsroom", "articles.json");
const READER_TERMS_PATH = path.join(process.cwd(), "content", "editorial", "reader-terms.json");
const MODEL = process.env.NEWSROOM_MODEL || "openai/gpt-4o";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const RECENT_WINDOW_MS = 45 * 60 * 1000;
const MAX_POLISH_PER_RUN = 4;

const STYLE_PROFILES = {
  futebol: "Redação de futebol: texto brasileiro, direto e envolvente. Explique o significado esportivo do fato sem criar contexto de tabela, escalação, gols ou bastidores que não estejam nos fatos.",
  nfl: "Redação de NFL: linguagem clara para fã de futebol americano, contextualizando impacto competitivo apenas quando os fatos fornecidos permitirem. Não invente estatísticas, depth chart ou histórico.",
  "college-football": "Redação de College Football: destaque programa, conferência, recrutamento, portal ou cenário competitivo somente quando isso estiver nos fatos. Evite pressupor rankings ou implicações não fornecidas.",
  nba: "Redação de NBA: ritmo de cobertura de liga, com foco no que muda para equipe ou jogador apenas se sustentado pelos fatos. Não acrescente médias, contratos ou contexto de tabela ausente.",
  formula1: "Redação de Fórmula 1: estilo de paddock e automobilismo, explicando sessão, corrida, decisão ou movimento apenas com base nos fatos. Não invente estratégia, pneus, tempos ou falas.",
  tenis: "Redação de tênis: texto de circuito ATP/WTA, torneios e rankings, sem inventar placares, chave, pontos ou histórico. Valorize clareza e consequência factual.",
  "tour-de-france": "Redação de ciclismo e Tour de France: narrativa de etapa e classificação apenas quando sustentada. Não invente ataques, fugas, montanhas, tempos ou camisas.",
  mlb: "Redação de MLB: cobertura de beisebol com linguagem natural, sem inventar innings, pitchers, home runs ou estatísticas. Explique o resultado somente até onde os fatos permitem.",
  golfe: "Redação de golfe: linguagem de circuito e torneio, sem inventar tacadas, buracos, leaderboard ou premiação. Contextualize somente o que estiver confirmado.",
  surfe: "Redação de surfe/WSL: cobertura fluida do circuito e atletas, sem inventar notas, baterias, ondas ou ranking. Dê atenção ao Brazilian Storm quando isso constar nos fatos.",
};

function normalize(value = "") {
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function words(value = "") { return String(value).trim().split(/\s+/).filter(Boolean); }
function numericTokens(value = "") { return normalize(value).match(/\b\d+(?:[.,]\d+)?\b/g) || []; }
function meaningfulTokens(value = "") { return new Set(normalize(value).split(" ").filter((token) => token.length >= 4)); }

function overlapScore(a, b) {
  const left = meaningfulTokens(a); const right = meaningfulTokens(b);
  if (!left.size || !right.size) return 0;
  let shared = 0; for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.max(1, left.size);
}

function stripCodeFence(value = "") { return value.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim(); }

function extractVerifiedFacts(article) {
  return String(article.content || "").split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean)
    .filter((paragraph) => !/^A LAP seguirá acompanhando o assunto/i.test(paragraph))
    .filter((paragraph) => !/^Esta é uma matéria produzida pela Redação LAP/i.test(paragraph));
}

function shouldPolish(article, now) {
  if (!article || typeof article !== "object") return false;
  if (!String(article.id || "").startsWith("newsroom-")) return false;
  if (article.dataDriven || article.editorialPolished) return false;
  const publishedAt = new Date(article.publishedAt || article.createdAt || 0).getTime();
  return Number.isFinite(publishedAt) && now - publishedAt <= RECENT_WINDOW_MS;
}

function readerGlossaryFor(article, terms) {
  return terms
    .filter((term) => Array.isArray(term?.sportIds) && term.sportIds.includes(article.sportId))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, 14)
    .map((term) => ({ aliases: term.aliases, expansion: term.expansion || null, definition: term.definition }));
}

function validatePolished(article, polished, facts) {
  const content = String(polished?.content || "").trim();
  const summary = String(polished?.summary || "").trim();
  if (!content || !summary) return false;
  const wordCount = words(content).length;
  const paragraphCount = content.split(/\n\s*\n/).filter((item) => item.trim()).length;
  if (wordCount < 140 || wordCount > 560 || paragraphCount < 4) return false;
  if (summary.length < 45 || summary.length > 360) return false;
  const banned = /base estruturada|fonte esportiva estruturada|esta é uma matéria produzida|o evento consta|como inteligência artificial/i;
  if (banned.test(content) || banned.test(summary)) return false;
  const evidence = `${article.title || ""} ${facts.join(" ")}`;
  const allowedNumbers = new Set(numericTokens(evidence));
  if (numericTokens(`${summary} ${content}`).some((number) => !allowedNumbers.has(number))) return false;
  const supportedFacts = facts.filter((fact) => overlapScore(fact, content) >= 0.3);
  return supportedFacts.length >= Math.min(2, facts.length);
}

async function polishArticle(article, facts, readerGlossary) {
  const agentId = String(article.agentId || "");
  const style = STYLE_PROFILES[agentId] || "Redação esportiva profissional: texto natural, informativo e fluido, sem inventar contexto além dos fatos confirmados.";
  const targetWords = facts.length >= 4 ? "260 a 440" : "170 a 300";
  const instructions = `Você é um redator esportivo sênior da LAP Live Sports e recebe SOMENTE fatos que já passaram por fact-check determinístico. Sua tarefa é transformar esses fatos em uma matéria jornalística original, fluida e agradável de ler.\n\nESTILO DA EDITORIA:\n${style}\n\nREGRAS ABSOLUTAS:\n1. Use exclusivamente os fatos verificados fornecidos. Não acrescente nomes, números, datas, locais, estatísticas, histórico, causas, consequências específicas, declarações ou detalhes que não estejam nos fatos.\n2. Você pode melhorar transições, ritmo, organização, lead e explicação, mas não criar novas alegações factuais.\n3. Escreva como jornalista esportivo, não como sistema. Nunca mencione base de dados, IA, prompt, fact-check, fonte estruturada ou processo automatizado.\n4. Produza entre ${targetWords} palavras, em 4 a 8 parágrafos curtos. Evite repetição e enchimento artificial.\n5. O primeiro parágrafo deve ser um lead claro. Os seguintes devem organizar e explicar os fatos disponíveis. O fechamento pode indicar que o assunto segue em desenvolvimento, sem prometer fatos futuros.\n6. Não copie formulações de terceiros. O texto deve ser autoral.\n7. Preserve exatamente qualquer número que decidir usar.\n8. summary deve ter de 1 a 2 frases e resumir apenas os fatos verificados.\n9. CLAREZA PARA O LEITOR: ao usar uma sigla, expressão em inglês ou jargão técnico que possa interromper a compreensão, explique seu significado de forma curta e natural na PRIMEIRA ocorrência. A explicação deve fazer parte da frase ou do parágrafo, não virar glossário, nota de rodapé ou aula.\n10. Para explicar jargões, use SOMENTE as definições fornecidas em readerGlossary. Não invente definições com conhecimento próprio. Se um termo não estiver no glossário, prefira uma expressão em português ou deixe o termo sem uma definição especulativa.\n11. Explique apenas o que realmente ajuda a entender a notícia, normalmente de 1 a 5 termos por matéria. Não explique palavras comuns nem trate o leitor de forma infantilizada.\n12. Não introduza um termo técnico só para poder explicá-lo. A explicação existe para servir à notícia, não o contrário.\n\nRetorne SOMENTE JSON válido: {"summary":"...","content":"..."}`;

  const response = await fetch("https://models.github.ai/inference/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.35,
      max_tokens: 2400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: instructions },
        { role: "user", content: JSON.stringify({ title: article.title, sport: agentId, verifiedFacts: facts, readerGlossary }) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`GitHub Models respondeu ${response.status}: ${await response.text()}`);
  const payload = await response.json();
  const raw = payload?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("O redator especializado não devolveu conteúdo.");
  return JSON.parse(stripCodeFence(raw));
}

async function main() {
  if (!GITHUB_TOKEN) { console.log("GITHUB_TOKEN ausente; etapa de polimento editorial ignorada."); return; }
  const [raw, readerTermsRaw] = await Promise.all([
    readFile(CONTENT_PATH, "utf8"),
    readFile(READER_TERMS_PATH, "utf8").catch(() => "[]"),
  ]);
  const articles = JSON.parse(raw);
  const readerTerms = JSON.parse(readerTermsRaw);
  if (!Array.isArray(articles)) throw new Error("Arquivo de matérias inválido.");
  const now = Date.now();
  let polishedCount = 0;

  for (const article of articles) {
    if (polishedCount >= MAX_POLISH_PER_RUN || !shouldPolish(article, now)) continue;
    const facts = extractVerifiedFacts(article);
    if (facts.length < 2) continue;
    try {
      const polished = await polishArticle(article, facts, readerGlossaryFor(article, Array.isArray(readerTerms) ? readerTerms : []));
      if (!validatePolished(article, polished, facts)) {
        console.warn(`[${article.agentId}] texto especializado rejeitado pela validação: ${article.title}`);
        continue;
      }
      article.summary = String(polished.summary).trim();
      article.content = String(polished.content).trim();
      article.seoDescription = article.summary.slice(0, 170);
      article.updatedAt = new Date().toISOString();
      article.editorialPolished = true;
      article.editorialDesk = article.agentId || "geral";
      article.readerClarity = true;
      polishedCount += 1;
      console.log(`[${article.agentId}] matéria revisada pela mesa especializada com clareza para o leitor: ${article.title}`);
    } catch (error) {
      console.error(`[${article.agentId}] falha no polimento editorial:`, error instanceof Error ? error.message : error);
    }
  }

  if (!polishedCount) { console.log("Nenhuma matéria nova exigiu polimento editorial nesta rodada."); return; }
  await writeFile(CONTENT_PATH, `${JSON.stringify(articles, null, 2)}\n`, "utf8");
  console.log(`${polishedCount} matérias passaram pela mesa editorial especializada.`);
}

main().catch((error) => {
  console.error("Falha na mesa editorial especializada da LAP:", error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});
