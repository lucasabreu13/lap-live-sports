import assert from "node:assert/strict";
import test from "node:test";
import { decodeArticleTransport, encodeArticleTransport } from "../lib/live-data";

test("article transport preserves a current story and its specific image", () => {
  const story = {
    slug: "noticia-atual",
    sportId: "futebol" as const,
    title: "Notícia atual",
    excerpt: "Resumo confirmado da notícia atual.",
    source: "ESPN Brasil",
    url: "https://www.espn.com.br/futebol/artigo/_/id/123",
    publishedAt: "2026-08-18T18:00:00Z",
    imageUrl: "https://a.espncdn.com/photo/2026/0818/noticia.jpg",
    imageAlt: "Imagem ligada à notícia atual",
  };

  assert.deepEqual(decodeArticleTransport(encodeArticleTransport(story)), story);
});

test("article transport rejects a non-http source URL", () => {
  const encoded = Buffer.from(JSON.stringify({
    slug: "noticia-invalida",
    sportId: "futebol",
    title: "Notícia inválida",
    excerpt: "Resumo inválido.",
    source: "Fonte",
    url: "javascript:alert(1)",
  }), "utf8").toString("base64url");

  assert.equal(decodeArticleTransport(encoded), null);
});
