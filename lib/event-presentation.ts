import type { EventKind, ScoreItem } from "@/lib/live-data";

type EventShape = Pick<ScoreItem, "eventKind" | "sportId" | "home" | "away">;

export function isHeadToHeadEvent(event: Pick<EventShape, "eventKind">) {
  return !event.eventKind || event.eventKind === "match" || event.eventKind === "fight";
}

export function isSingleEvent(event: Pick<EventShape, "eventKind">) {
  return !isHeadToHeadEvent(event);
}

export function eventDisplayTitle(event: EventShape, separator = "x") {
  return isSingleEvent(event) ? event.home.name : `${event.home.name} ${separator} ${event.away.name}`;
}

export function eventKindLabel(kind: EventKind | undefined) {
  if (kind === "race") return "Grande Prêmio";
  if (kind === "tournament") return "Torneio";
  if (kind === "fight") return "Luta";
  if (kind === "stage") return "Etapa";
  if (kind === "meet") return "Prova";
  return "Jogo";
}

export function eventPreLabel(event: Pick<EventShape, "eventKind">) {
  if (event.eventKind === "race") return "PRÓXIMO GP";
  if (event.eventKind === "tournament") return "PRÓXIMO TORNEIO";
  if (event.eventKind === "fight") return "PRÓXIMA LUTA";
  if (event.eventKind === "stage") return "PRÓXIMA ETAPA";
  if (event.eventKind === "meet") return "PRÓXIMA PROVA";
  return "EM BREVE";
}
