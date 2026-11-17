import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAction,
  text,
  uuid,
  verifyGoogleAccess,
} from "../server/validation";
import { readFileSync } from "node:fs";
const key = "85930811-d074-4d6a-9913-c8a627808b54";
test("private Google access requires an explicitly allowed verified email", () => {
  assert.doesNotThrow(() =>
    verifyGoogleAccess(
      { email: "Owner@Example.com", email_verified: true },
      " owner@example.com ",
    ),
  );
  for (const claims of [
    { email: "other@example.com", email_verified: true },
    { email: "owner@example.com", email_verified: false },
    { email_verified: true },
    { email: "owner@example.com", email_verified: "true" },
  ])
    assert.throws(() => verifyGoogleAccess(claims, "owner@example.com"));
  assert.doesNotThrow(() => verifyGoogleAccess({}, undefined));
});
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

test("business actions accept only existing catalog identifiers", () => {
  for (const kind of ["buyBusiness", "collectBusiness", "upgradeBusiness"]) {
    for (const id of ["fake", "", "programme", "programmes; DROP TABLE", null])
      assert.throws(() => validateAction({ key, kind, input: { id } }));
    for (const id of ["programmes", "merchandise", "academy"])
      assert.equal(validateAction({ key, kind, input: { id } }).input.id, id);
  }
});
