import { test } from "node:test";
import assert from "node:assert/strict";
import {
  quoteActivity,
  rarityClass,
  sortSquad,
  staminaState,
} from "../src/game-view";
import type { Player, Activity, Asset } from "../src/types";
const p = { mastery: {}, facility: 0 } as Player;
const a = { id: "flyers", chance: 68, cost: 10, reward: 30 } as Activity;
test("stamina prediction matches thirty-second server ticks and capacity", () => {
  const start = Date.parse("2026-11-17T08:00:00Z");
  const p = {
    energy: 10,
    energyAt: new Date(start).toISOString(),
    energyMax: 205,
    energyRegen: 5,
    energyInterval: 30,
  } as Player;
  assert.equal(staminaState(p, start + 29000).current, 10);
  assert.equal(staminaState(p, start + 30000).current, 15);
  assert.equal(staminaState(p, start + 60000).current, 20);
  assert.equal(staminaState(p, start + 9999999).current, 205);
  assert.equal(staminaState(p, start - 10000).current, 10);
});
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
test("focus training improves displayed chances with a bounded bonus", () => {
  const base = quoteActivity(
    { ...p, attributes: { focus: 1 } },
    a,
    "steady",
  ).chance;
  assert.equal(
    quoteActivity({ ...p, attributes: { focus: 5 } }, a, "steady").chance,
    base + 1,
  );
  assert.equal(
    quoteActivity({ ...p, attributes: { focus: 100 } }, a, "steady").chance,
    base + 5,
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
