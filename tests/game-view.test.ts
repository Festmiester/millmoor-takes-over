import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteActivity, rarityClass, sortSquad } from "../src/game-view";
import type { Player, Activity, Asset } from "../src/types";
const p = { mastery: {}, facility: 0 } as Player;
const a = { id: "flyers", chance: 68, cost: 10, reward: 30 } as Activity;
test("quotes include outlay on success and expected cash return", () => {
  assert.deepEqual(quoteActivity(p, a, "steady"), {
    chance: 68,
    gross: 30,
    net: 20,
    expected: 10,
  });
  assert.deepEqual(quoteActivity(p, a, "safe"), {
    chance: 78,
    gross: 24,
    net: 14,
    expected: 9,
  });
  assert.equal(quoteActivity(p, a, "bold").gross, 39);
  assert.equal(
    quoteActivity({ ...p, mastery: { flyers: 100 } }, a, "safe").chance,
    95,
  );
});
test("squad filtering and sorting never mutate the saved roster", () => {
  const roster = [
    { name: "Zed", position: "DEF", power: 10, value: 100 },
    { name: "Ash", position: "MID", power: 20, value: 200 },
  ] as Asset[];
  assert.equal(sortSquad(roster, "all", "name")[0].name, "Ash");
  assert.equal(roster[0].name, "Zed");
  assert.equal(sortSquad(roster, "DEF", "power").length, 1);
  assert.equal(sortSquad(roster, "all", "value")[0].value, 200);
  assert.equal(rarityClass("<script>"), "local");
});
