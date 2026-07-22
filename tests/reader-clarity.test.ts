import assert from "node:assert/strict";
import test from "node:test";
import { enrichArticleForReaders } from "@/lib/reader-clarity";

test("explains tampering and discovery rights naturally for MLS coverage", () => {
  const input = "A MLS investiga possível tampering relacionado aos discovery rights do jogador.";
  const output = enrichArticleForReaders(input, "futebol");
  assert.match(output, /tampering — contato ou negociação/i);
  assert.match(output, /discovery rights — mecanismo da MLS/i);
});

test("expands NFL roster acronyms only on first occurrence", () => {
  const input = "Taylor Moton entrou na lista NFI. Outro jogador também está na NFI, enquanto Seattle tem nomes na PUP e discute o depth chart.";
  const output = enrichArticleForReaders(input, "futebol-americano");
  assert.equal((output.match(/Non-Football Injury/g) || []).length, 1);
  assert.equal((output.match(/Physically Unable to Perform/g) || []).length, 1);
  assert.match(output, /depth chart — hierarquia do elenco por posição/i);
});

test("does not add a second explanation when the term is already explained", () => {
  const input = "A trade deadline — prazo final para trocas entre equipes — está próxima.";
  const output = enrichArticleForReaders(input, "beisebol");
  assert.equal(output, input);
});

test("limits explanations so the article does not turn into a glossary", () => {
  const input = "A trade deadline se aproxima. O atleta está na IL. O bullpen mudou. Houve walk-off. O rookie voltou. A free agency também entrou na pauta.";
  const output = enrichArticleForReaders(input, "beisebol", 3);
  const explanationMarkers = (output.match(/ — /g) || []).length + (output.match(/\(Injured List\)/g) || []).length;
  assert.ok(explanationMarkers >= 3);
  assert.doesNotMatch(output, /free agency —/i);
});
