import assert from "node:assert/strict";
import test from "node:test";
import { parseGameLineups } from "../lib/live-data";

test("parses official roster metadata without guessing starters or formation", () => {
  const lineups = parseGameLineups({
    rosters: [{
      team: {
        displayName: "LAP FC",
        logos: [{ href: "https://example.com/lap.png" }],
      },
      formation: "4-3-3",
      roster: [
        {
          active: true,
          starter: true,
          jersey: "10",
          formationPlace: "8",
          athlete: { id: "player-1", displayName: "Jogador Titular" },
          position: { abbreviation: "MEI" },
        },
        {
          active: true,
          starter: false,
          jersey: "19",
          athlete: { id: "player-2", displayName: "Jogador Reserva" },
          position: { abbreviation: "ATA" },
        },
      ],
    }],
  });

  assert.equal(lineups.length, 1);
  assert.equal(lineups[0].team, "LAP FC");
  assert.equal(lineups[0].logo, "https://example.com/lap.png");
  assert.equal(lineups[0].formation, "4-3-3");
  assert.deepEqual(lineups[0].players, ["Jogador Titular", "Jogador Reserva"]);
  assert.equal(lineups[0].members?.[0].starter, true);
  assert.equal(lineups[0].members?.[0].jersey, "10");
  assert.equal(lineups[0].members?.[0].position, "MEI");
  assert.equal(lineups[0].members?.[1].starter, false);
});

test("uses boxscore athletes when a sport has no roster section", () => {
  const lineups = parseGameLineups({
    boxscore: {
      players: [{
        team: { displayName: "LAP Basketball", logo: "https://example.com/basket.png" },
        statistics: [{
          athletes: [{
            starter: true,
            athlete: { id: "guard-1", displayName: "Armador LAP" },
            position: { abbreviation: "PG" },
          }],
        }],
      }],
    },
  });

  assert.equal(lineups.length, 1);
  assert.equal(lineups[0].players[0], "Armador LAP");
  assert.equal(lineups[0].members?.[0].position, "PG");
});

test("returns no lineup when the provider publishes no participants", () => {
  assert.deepEqual(parseGameLineups({}), []);
});
