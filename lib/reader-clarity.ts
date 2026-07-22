import readerTermsPayload from "@/content/editorial/reader-terms.json";
import type { SportId } from "@/lib/live-data";

type ReaderTerm = {
  id: string;
  sportIds: SportId[];
  aliases: string[];
  priority: number;
  style: "dash" | "expansion" | "expansion-optional";
  expansion?: string;
  definition: string;
};

const READER_TERMS = readerTermsPayload as ReaderTerm[];
const DEFAULT_MAX_EXPLANATIONS = 5;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRegex(alias: string) {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(alias)}(?![\\p{L}\\p{N}])`, "iu");
}

function alreadyExplained(text: string, endIndex: number) {
  const after = text.slice(endIndex, endIndex + 120);
  return /^\s*(?:\([^)]{3,100}\)|[—–-]\s*[^—–\n]{3,110}[—–-]|,\s*(?:isto é|ou seja|termo|sigla|mecanismo|lista|categoria)\b)/iu.test(after);
}

function inlineExplanation(match: string, rule: ReaderTerm, before: string) {
  let definition = rule.definition;
  if (/lista\s*$/iu.test(before) && /^lista\s+/iu.test(definition)) {
    definition = definition.replace(/^lista\s+/iu, "categoria ");
  }

  if (rule.style === "expansion" || rule.style === "expansion-optional") {
    const expansion = rule.expansion?.trim();
    if (expansion && expansion.localeCompare(match, "pt-BR", { sensitivity: "base" }) !== 0) {
      return `${match} (${expansion}) — ${definition} —`;
    }
  }

  return `${match} — ${definition} —`;
}

/**
 * Adds concise explanations to the first occurrence of high-friction sports jargon.
 * The glossary is controlled editorially; no definition is generated at render time.
 */
export function enrichArticleForReaders(content: string, sportId: SportId, maxExplanations = DEFAULT_MAX_EXPLANATIONS) {
  let enriched = content;
  let applied = 0;
  const rules = READER_TERMS
    .filter((rule) => rule.sportIds.includes(sportId))
    .sort((a, b) => b.priority - a.priority);

  for (const rule of rules) {
    if (applied >= maxExplanations) break;

    let selected: { alias: string; index: number; match: string } | null = null;
    for (const alias of rule.aliases.sort((a, b) => b.length - a.length)) {
      const found = termRegex(alias).exec(enriched);
      if (!found || alreadyExplained(enriched, found.index + found[0].length)) continue;
      if (!selected || found.index < selected.index) selected = { alias, index: found.index, match: found[0] };
    }
    if (!selected) continue;

    const before = enriched.slice(Math.max(0, selected.index - 24), selected.index);
    const replacement = inlineExplanation(selected.match, rule, before);
    enriched = `${enriched.slice(0, selected.index)}${replacement}${enriched.slice(selected.index + selected.match.length)}`;
    applied += 1;
  }

  return enriched;
}
