import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker from "../server/worker";
const DATABASE_URL = readFileSync(".env.integration", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)![1];
const env = {
  DATABASE_URL,
  ENVIRONMENT: "test",
  ALLOW_TEST_ACCOUNTS: "true",
  ASSETS: { fetch: async () => new Response("asset") },
} as any;
const origin = "https://takes-over.test";
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log("PASS", name);
}
async function call(
  path: string,
  data?: unknown,
  cookie?: string,
  requestOrigin = origin,
) {
  return worker.fetch(
    new Request(origin + path, {
      method: data === undefined ? "GET" : "POST",
      headers: {
        ...(cookie ? { Cookie: cookie } : {}),
        ...(data === undefined
          ? {}
          : {
              Origin: requestOrigin,
              "X-MTO-Request": "1",
              "Content-Type": "application/json",
            }),
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    env,
  );
}
let sessionA = "",
  sessionB = "";
await check("anonymous accounts cannot read saved state", async () => {
  assert.equal((await call("/api/state")).status, 401);
});
await check("cross-origin account creation is rejected", async () => {
  assert.equal(
    (
      await call(
        "/api/test-account",
        { name: "A Manager", club: "One Club" },
        undefined,
        "https://evil.test",
      )
    ).status,
    403,
  );
});
await check("create two secure independent test sessions", async () => {
  for (const name of ["API Manager A", "API Manager B"]) {
    const r = await call("/api/test-account", { name, club: name + " FC" });
    assert.equal(r.status, 200);
    const c = r.headers.get("set-cookie")!;
    assert.match(c, /HttpOnly/);
    assert.match(c, /Secure/);
    assert.match(c, /SameSite=Lax/);
    if (!sessionA) sessionA = c.split(";")[0];
    else sessionB = c.split(";")[0];
  }
});
await check(
  "catalogue contains no rank thresholds or hidden activity rewards",
  async () => {
    const r = await call("/api/catalog");
    assert.equal(r.status, 200);
    const text = await r.text();
    assert.doesNotMatch(text, /threshold|"progress"|"xp"/i);
  },
);
await check(
  "gameplay changes one account, with replay protection",
  async () => {
    const payload = {
      key: crypto.randomUUID(),
      kind: "deposit",
      input: { amount: 50 },
    };
    const first = await call("/api/action", payload, sessionA);
    assert.equal(first.status, 200);
    const result = (await first.json()) as any;
    assert.equal(result.player.cash, 200);
    assert.equal(result.player.bank, 50);
    const again = await call("/api/action", payload, sessionA);
    assert.deepEqual(await again.json(), result);
    const b = (await (
      await call("/api/state", undefined, sessionB)
    ).json()) as any;
    assert.equal(b.player.cash, 250);
    assert.equal(b.player.bank, 0);
    assert.notEqual(b.player.id, result.player.id);
    assert.equal("xp" in result.player, false);
  },
);
await check("malicious balances and unknown actions are rejected", async () => {
  for (const input of [
    { kind: "deposit", input: { amount: -10 } },
    { kind: "setMoney", input: { amount: 1e9 } },
  ])
    assert.equal(
      (
        await call(
          "/api/action",
          { ...input, key: crypto.randomUUID() },
          sessionA,
        )
      ).status,
      400,
    );
});
await check(
  "locked activity enforcement survives a direct forged request",
  async () => {
    const r = await call(
      "/api/action",
      { key: crypto.randomUUID(), kind: "activity", input: { id: "legend" } },
      sessionB,
    );
    assert.equal(r.status, 409);
    assert.match(((await r.json()) as any).error, /required rank/);
  },
);
await check("session logout invalidates server access", async () => {
  assert.equal((await call("/api/logout", {}, sessionB)).status, 200);
  assert.equal((await call("/api/state", undefined, sessionB)).status, 401);
});
await check("OAuth fails closed until credentials exist", async () => {
  assert.equal((await call("/auth/google")).status, 503);
  assert.equal((await call("/auth/callback?state=fake&code=fake")).status, 401);
});
await check("production rejects disposable test accounts", async () => {
  const r = await worker.fetch(
    new Request(origin + "/api/test-account", {
      method: "POST",
      headers: {
        Origin: origin,
        "X-MTO-Request": "1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "Test", club: "Test" }),
    }),
    { ...env, ENVIRONMENT: "production" },
  );
  assert.equal(r.status, 403);
});
await check("responses include browser security headers", async () => {
  const r = await call("/api/health");
  assert.match(
    r.headers.get("Content-Security-Policy")!,
    /frame-ancestors 'none'/,
  );
  assert.equal(r.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(r.headers.get("Cache-Control"), "no-store");
});
console.log(`${passed} API smoke tests passed.`);
