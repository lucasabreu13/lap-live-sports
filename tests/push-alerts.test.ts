import assert from "node:assert/strict";
import test from "node:test";
import { alertDeliveryKey, buildPushAlertsForScore, favoriteMatchesScore, liveEventKey } from "../lib/push-alerts";
import type { LiveEventSnapshot } from "../lib/push-store";

function score(overrides: Record<string, unknown> = {}) {
  return {
    id: "401",
    sportId: "futebol",
    league: "Brasileirão",
    round: "Rodada",
    venue: null,
    broadcast: null,
    status: "67'",
    state: "in",
    integrity: "verified",
    integrityReason: null,
    startTime: new Date(Date.now() + 45 * 60_000).toISOString(),
    competitionId: "brasileirao-a",
    eventKind: "match",
    home: { name: "Flamengo", score: "2" },
    away: { name: "Palmeiras", score: "1" },
    ...overrides,
  } as any;
}

function snapshot(overrides: Partial<LiveEventSnapshot> = {}): LiveEventSnapshot {
  return {
    eventKey: "futebol:401",
    sportId: "futebol",
    eventId: "401",
    state: "in",
    integrity: "verified",
    status: "60'",
    homeScore: "1",
    awayScore: "1",
    timelineHash: null,
    lineupHash: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

test("favorite matching supports event, sport, league and team ids", () => {
  const item = score();
  assert.equal(favoriteMatchesScore(item, ["event:futebol:401"]), true);
  assert.equal(favoriteMatchesScore(item, ["sport:futebol"]), true);
  assert.equal(favoriteMatchesScore(item, ["league:brasileirao-a"]), true);
  assert.equal(favoriteMatchesScore(item, ["team:flamengo"]), true);
  assert.equal(favoriteMatchesScore(item, ["team:corinthians"]), false);
});

test("score change creates one deterministic score alert for the same change", () => {
  const item = score();
  const previous = snapshot();
  const first = buildPushAlertsForScore(item, previous);
  const second = buildPushAlertsForScore(item, previous);
  const scoreAlert = first.find((alert) => alert.eventType === "score");

  assert.ok(scoreAlert);
  assert.equal(scoreAlert?.title, "LAP · Gol do Flamengo");
  assert.equal(second.find((alert) => alert.eventType === "score")?.eventHash, scoreAlert?.eventHash);
});

test("delivery key changes only when event hash changes", () => {
  const item = score();
  const alert = buildPushAlertsForScore(item, snapshot()).find((candidate) => candidate.eventType === "score");
  assert.ok(alert);
  const key = alertDeliveryKey("sub-1", alert!);
  assert.equal(alertDeliveryKey("sub-1", alert!), key);
  assert.notEqual(alertDeliveryKey("sub-1", { ...alert!, eventHash: "other" }), key);
});

test("reconciling events do not generate push alerts", () => {
  const alerts = buildPushAlertsForScore(score({ integrity: "reconciling" }), snapshot());
  assert.equal(alerts.length, 0);
});

test("live event key includes World Cup namespace when needed", () => {
  assert.equal(liveEventKey(score({ isWorldCup: true })), "futebol:401:cup");
});
