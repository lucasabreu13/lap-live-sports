import assert from "node:assert/strict";
import test from "node:test";
import {
  applyScorePatchWithIntegrity,
  canDisplayScore,
  getScoreIntegrity,
  withScoreIntegrity,
  type ScoreLike,
} from "../lib/score-integrity";

function match(overrides: Partial<ScoreLike> = {}) {
  return withScoreIntegrity({
    id: "event-1",
    sportId: "futebol",
    state: "pre",
    status: "Agenda confirmada",
    eventKind: "match",
    home: { name: "LAP A", score: null },
    away: { name: "LAP B", score: null },
    ...overrides,
  } as ScoreLike & { id: string; sportId: string });
}

test("pre-game without score is verified and does not display a score", () => {
  const score = match();
  assert.equal(score.integrity, "verified");
  assert.equal(canDisplayScore(score), false);
});

test("pre-game with an unexpected score is reconciling", () => {
  const score = match({ home: { name: "LAP A", score: "0" }, away: { name: "LAP B", score: "0" } });
  assert.equal(score.integrity, "reconciling");
  assert.equal(canDisplayScore(score), false);
});

test("live match with a complete score is verified", () => {
  const score = match({ state: "in", status: "67'", home: { name: "LAP A", score: "2" }, away: { name: "LAP B", score: "1" } });
  assert.equal(score.integrity, "verified");
  assert.equal(canDisplayScore(score), true);
});

test("finished match with a complete score is verified", () => {
  const score = match({ state: "post", status: "Final", home: { name: "LAP A", score: "2" }, away: { name: "LAP B", score: "1" } });
  assert.equal(score.integrity, "verified");
  assert.equal(canDisplayScore(score), true);
});

test("unknown state with score is reconciling", () => {
  const result = getScoreIntegrity(
    "unknown",
    { name: "LAP A", score: "3" },
    { name: "LAP B", score: "4" },
  );
  assert.equal(result.integrity, "reconciling");
});

test("score patch recalculates integrity before UI can display it", () => {
  const initial = match();
  const patched = applyScorePatchWithIntegrity(initial, {
    eventId: "event-1",
    sportId: "futebol",
    homeScore: "3",
    awayScore: "4",
  });

  assert.equal(patched.integrity, "reconciling");
  assert.equal(canDisplayScore(patched), false);
});
