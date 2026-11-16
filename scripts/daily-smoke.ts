import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const connection = readFileSync(".env.integration", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)![1];
const live = readFileSync(".dev.vars.test", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)![1];
assert.notEqual(
  new URL(connection).hostname,
  new URL(live).hostname,
  "Verification database must be separate",
);
assert.equal(new URL(connection).pathname, "/takes_over");
const sql = neon(connection);
const [p] =
  await sql`INSERT INTO mto_players(identity,name,club) VALUES(${"fixture:" + crypto.randomUUID()},'Daily Test','Daily Test FC') RETURNING id`;
const id = p.id;
let passed = 0;
async function test(name: string, run: () => Promise<void>) {
  await run();
  console.log("PASS", name);
  passed++;
}
async function status() {
  return (await sql`SELECT mto_daily(${id}::uuid) AS d`)[0].d;
}
async function claim(goal: string, key = crypto.randomUUID()) {
  return (
    await sql`SELECT mto_claim_daily(${id}::uuid,${key}::uuid,${goal}) AS r`
  )[0].r;
}
await test("new player has three incomplete goals and UTC next-day reset", async () => {
  const d = await status();
  assert.equal(d.goals.length, 3);
  assert.ok(d.goals.every((g: any) => g.progress === 0 && !g.claimed));
  assert.match(d.resetsAt, /00:00:00/);
  await assert.rejects(claim("shift"), /Complete/);
  await assert.rejects(claim("unknown"), /Unknown/);
});
await test("only current-day player events count", async () => {
  await sql`INSERT INTO mto_events(player_id,kind,message,cash_delta,created_at) VALUES(${id}::uuid,'activity','Yesterday',30,now()-interval '1 day')`;
  assert.equal(
    (await status()).goals.find((g: any) => g.id === "shift").progress,
    0,
  );
});
await test("bank action advances savings and replay gives only one reward", async () => {
  await sql`SELECT mto_action(${id}::uuid,${crypto.randomUUID()}::uuid,'deposit','{"amount":1}'::jsonb)`;
  const key = crypto.randomUUID();
  const results = await Promise.all([
    claim("savings", key),
    claim("savings", key),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(results[0].player.cash, 274);
  assert.equal(results[0].player.bank, 1);
  await assert.rejects(claim("savings"), /already claimed/);
});
await test("concurrent different keys cannot double-claim a completed goal", async () => {
  await sql`INSERT INTO mto_events(player_id,kind,message,cash_delta) SELECT ${id}::uuid,'activity','Fixture completed',30 FROM generate_series(1,5)`;
  const results = await Promise.allSettled([claim("shift"), claim("shift")]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(
    Number(
      (await sql`SELECT cash FROM mto_players WHERE id=${id}::uuid`)[0].cash,
    ),
    314,
  );
});
await test("profit excludes bank rewards, claims do not award rank progress", async () => {
  const result = await claim("profit");
  assert.equal(result.player.cash, 389);
  assert.equal("xp" in result.player, false);
  assert.equal(
    Number((await sql`SELECT xp FROM mto_players WHERE id=${id}::uuid`)[0].xp),
    0,
  );
  const d = await status();
  assert.ok(d.goals.every((g: any) => g.claimed));
  const [other] =
    await sql`INSERT INTO mto_players(identity,name,club) VALUES(${"fixture:" + crypto.randomUUID()},'Other Daily','Other FC') RETURNING id`;
  assert.ok(
    (await sql`SELECT mto_daily(${other.id}::uuid) AS d`)[0].d.goals.every(
      (g: any) => g.progress === 0 && !g.claimed,
    ),
  );
});
console.log(`${passed} daily assignment checks passed on verification branch`);
