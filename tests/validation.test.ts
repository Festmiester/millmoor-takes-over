import { test } from "node:test";
import assert from "node:assert/strict";
import { validateAction, text, uuid } from "../server/validation";
import { readFileSync } from "node:fs";
const key = "85930811-d074-4d6a-9913-c8a627808b54";
test("money only accepts positive bounded integer amounts", () => {
  for (const amount of [-1, 0, 1.5, 1e10, "10", null, {}, NaN])
    assert.throws(() =>
      validateAction({ key, kind: "deposit", input: { amount } }),
    );
  assert.equal(
    validateAction({ key, kind: "deposit", input: { amount: 50 } }).input
      .amount,
    50,
  );
});
test("requests need a replay-safe UUID and a known action", () => {
  assert.throws(() => validateAction({ key: "bad", kind: "deposit" }));
  assert.throws(() => validateAction({ key, kind: "setMoney" }));
  assert.ok(uuid(key));
});
test("foreign player references are validated before SQL", () => {
  assert.throws(() =>
    validateAction({ key, kind: "buyListing", input: { id: "' OR 1=1" } }),
  );
  assert.throws(() =>
    validateAction({ key, kind: "challenge", input: { target: "bob" } }),
  );
});
test("display names reject markup and controls", () => {
  assert.throws(() => text("<script>", 2, 24, "Name"));
  assert.throws(() => text("a\nname", 2, 24, "Name"));
  assert.equal(text(" Kurt ", 2, 24, "Name"), "Kurt");
});
test("rank thresholds and activity progress stay outside browser source", () => {
  const source = readFileSync("src/main.ts", "utf8");
  assert.doesNotMatch(source, /750000|460000|threshold|\.xp\b|Experience \+/);
});
test("production deployment has no automatic CI or configured production environment", () => {
  const cfg = readFileSync("wrangler.toml", "utf8");
  assert.doesNotMatch(cfg, /\[env\.production/);
  assert.match(cfg, /workers_dev = false/);
});
