export type ScoreState = "pre" | "in" | "post" | "unknown";
export type ScoreIntegrity = "verified" | "reconciling";

export type ScoreSide = {
  name: string;
  score: string | number | null;
};

export type ScoreLike = {
  state: ScoreState;
  status?: string | null;
  eventKind?: "match" | "race" | "tournament" | "fight" | "stage" | "meet";
  home: ScoreSide;
  away: ScoreSide;
  integrity?: ScoreIntegrity;
  integrityReason?: string | null;
};

export type ScoreIntegrityResult = {
  integrity: ScoreIntegrity;
  reason: string | null;
};

export type ScorePatch<TState extends string = ScoreState> = {
  eventId: string;
  sportId?: string;
  state?: TState;
  status?: string;
  homeScore?: string | number | null;
  awayScore?: string | number | null;
};

const RECONCILIATION_MESSAGE = "O placar está em confirmação e será exibido assim que estiver consistente.";

function normalizeScore(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text || text === "-" || text === "—") return null;
  return text;
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function statusLooksScheduled(status: string | null | undefined) {
  if (!status) return false;
  const normalized = normalizeText(status);
  return (
    normalized.includes("agenda confirmada") ||
    normalized.includes("horario a confirmar") ||
    normalized.includes("data a confirmar") ||
    normalized.includes("scheduled") ||
    normalized.includes("time tba") ||
    normalized.includes("tbd") ||
    normalized.includes("not started")
  );
}

export function hasAnyScore(home: ScoreSide, away: ScoreSide) {
  return normalizeScore(home.score) !== null || normalizeScore(away.score) !== null;
}

export function hasCompleteScore(home: ScoreSide, away: ScoreSide) {
  return normalizeScore(home.score) !== null && normalizeScore(away.score) !== null;
}

export function getScoreIntegrity(
  state: ScoreState,
  home: ScoreSide,
  away: ScoreSide,
  options: { status?: string | null; scoreApplies?: boolean } = {},
): ScoreIntegrityResult {
  const scoreApplies = options.scoreApplies !== false;
  const anyScore = hasAnyScore(home, away);
  const completeScore = hasCompleteScore(home, away);

  if (!scoreApplies) return { integrity: "verified", reason: null };

  if (state === "pre") {
    return anyScore
      ? { integrity: "reconciling", reason: RECONCILIATION_MESSAGE }
      : { integrity: "verified", reason: null };
  }

  if (state === "unknown") {
    return anyScore
      ? { integrity: "reconciling", reason: RECONCILIATION_MESSAGE }
      : { integrity: "verified", reason: null };
  }

  if ((state === "in" || state === "post") && anyScore && statusLooksScheduled(options.status)) {
    return { integrity: "reconciling", reason: RECONCILIATION_MESSAGE };
  }

  if ((state === "in" || state === "post") && !completeScore) {
    return { integrity: "reconciling", reason: RECONCILIATION_MESSAGE };
  }

  return { integrity: "verified", reason: null };
}

export function withScoreIntegrity<TScore extends ScoreLike>(score: TScore): TScore & { integrity: ScoreIntegrity; integrityReason: string | null } {
  const result = getScoreIntegrity(score.state, score.home, score.away, {
    status: score.status,
    scoreApplies: !score.eventKind || score.eventKind === "match",
  });
  return { ...score, integrity: result.integrity, integrityReason: result.reason };
}

export function applyScorePatchWithIntegrity<TScore extends ScoreLike & { id: string; sportId: string }>(
  score: TScore,
  patch: ScorePatch<TScore["state"]>,
) {
  if (score.id !== patch.eventId || (patch.sportId && score.sportId !== patch.sportId)) return score;
  return withScoreIntegrity({
    ...score,
    state: patch.state || score.state,
    status: patch.status ?? score.status,
    home: { ...score.home, score: patch.homeScore === undefined ? score.home.score : patch.homeScore },
    away: { ...score.away, score: patch.awayScore === undefined ? score.away.score : patch.awayScore },
  });
}

export function resolveScoreIntegrity(score: ScoreLike) {
  return score.integrity
    ? { integrity: score.integrity, reason: score.integrityReason ?? (score.integrity === "reconciling" ? RECONCILIATION_MESSAGE : null) }
    : getScoreIntegrity(score.state, score.home, score.away, { status: score.status, scoreApplies: !score.eventKind || score.eventKind === "match" });
}

export function isReconcilingScore(score: ScoreLike) {
  return resolveScoreIntegrity(score).integrity === "reconciling";
}

export function canDisplayScore(score: ScoreLike) {
  if (score.eventKind && score.eventKind !== "match") return false;
  const integrity = resolveScoreIntegrity(score).integrity;
  return integrity === "verified" && (score.state === "in" || score.state === "post") && hasCompleteScore(score.home, score.away);
}

export function displayScoreValue(score: ScoreLike, side: "home" | "away") {
  if (!canDisplayScore(score)) return "";
  return normalizeScore(score[side].score) ?? "";
}

export function scoreSeparator(score: ScoreLike) {
  if (score.eventKind === "race") return "GP";
  if (score.eventKind === "tournament") return "TORNEIO";
  if (score.eventKind === "fight") return "LUTA";
  if (score.eventKind === "stage") return "ETAPA";
  if (score.eventKind === "meet") return "PROVA";
  return canDisplayScore(score) ? "×" : "vs";
}

export function reconciliationMessage(score: ScoreLike) {
  const result = resolveScoreIntegrity(score);
  return result.integrity === "reconciling" ? result.reason ?? RECONCILIATION_MESSAGE : null;
}
