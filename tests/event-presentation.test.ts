import assert from "node:assert/strict";
import test from "node:test";
import { eventDisplayTitle, eventKindLabel, isSingleEvent } from "../lib/event-presentation";
import type { ScoreItem } from "../lib/live-data";

function event(eventKind: ScoreItem["eventKind"]): ScoreItem {
  return {
    id: "event-1",
    sportId: "golfe",
    league: "PGA Tour",
    round: null,
    venue: null,
    broadcast: null,
    status: "Em andamento",
    state: "in",
    integrity: "verified",
    integrityReason: null,
    startTime: null,
    eventKind,
    home: { name: "Scottish Open", score: null },
    away: { name: "PGA Tour", score: null },
  };
}

test("single events use their event name without a fake opponent", () => {
  const tournament = event("tournament");
  assert.equal(isSingleEvent(tournament), true);
  assert.equal(eventDisplayTitle(tournament), "Scottish Open");
  assert.equal(eventKindLabel(tournament.eventKind), "Torneio");
});

test("head-to-head events keep both participants", () => {
  const match = { ...event("match"), home: { name: "LAP A", score: null }, away: { name: "LAP B", score: null } };
  assert.equal(isSingleEvent(match), false);
  assert.equal(eventDisplayTitle(match), "LAP A x LAP B");
});
