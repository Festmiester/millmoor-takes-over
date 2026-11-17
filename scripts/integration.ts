import { neon } from "@neondatabase/serverless";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const vars = readFileSync(".env.integration", "utf8");
const databaseUrl = vars.match(/^DATABASE_URL=(.+)$/m)?.[1];
if (!databaseUrl) throw new Error("Integration database configuration missing");
const sql = neon(databaseUrl);
const created: string[] = [];
let passed = 0;
async function test(name: string, fn: () => Promise<void>) {
  await fn();
  passed++;
  console.log("PASS", name);
}
async function make(xp = 0, cash = 10000) {
  const rows =
    await sql`INSERT INTO mto_players(identity,name,club,xp,cash) VALUES(${"fixture:" + crypto.randomUUID()},'Integration Manager','Integration FC',${xp},${cash}) RETURNING id`;
  const id = rows[0].id;
  created.push(id);
  return id;
}
async function state(id: string) {
  return (await sql`SELECT mto_public(mto_refresh(${id}::uuid)) AS p`)[0].p;
}
async function action(
  id: string,
  kind: string,
  input: unknown = {},
  key = crypto.randomUUID(),
) {
  return (
    await sql`SELECT mto_action(${id}::uuid,${key}::uuid,${kind},${JSON.stringify(input)}::jsonb) AS result`
  )[0].result;
}
const beginner = await make(0, 250),
  advanced = await make(1500),
  buyer = await make(1500);
await test("starter state has hidden rank and exactly two unlocked activities", async () => {
  const p = await state(beginner);
  assert.equal(p.rankName, "Scum");
  assert.equal(p.cash, 250);
  assert.equal(p.energy, 200);
  assert.equal("xp" in p, false);
  const rows =
    await sql`SELECT id FROM mto_activities WHERE rank_required=0 ORDER BY id`;
  assert.deepEqual(
    rows.map((x) => x.id),
    ["coaching", "flyers"],
  );
});
await test("all thirteen boundaries promote correctly", async () => {
  const rows =
    await sql`SELECT id,mto_rank(threshold) AS at,mto_rank(greatest(0,threshold-1)) AS below FROM mto_ranks ORDER BY id`;
  assert.equal(rows.length, 13);
  for (const r of rows) {
    assert.equal(r.at, r.id);
    assert.equal(r.below, Math.max(0, r.id - 1));
  }
});
await test("rank lock rejects advanced activities", async () => {
  await assert.rejects(
    action(beginner, "activity", { id: "scout" }),
    /required rank/,
  );
});
await test("independent cooldowns permit coaching immediately after flyers", async () => {
  await action(beginner, "activity", { id: "flyers", approach: "steady" });
  await action(beginner, "activity", { id: "coaching", approach: "steady" });
  const p = await state(beginner);
  assert.ok(p.energy >= 192 && p.energy <= 200);
  assert.ok(p.cooldowns.flyers);
  assert.ok(p.cooldowns.coaching);
});
await test("cooldowns reject immediate repeats even with a different key", async () => {
  // Keep this assertion independent of network delays between earlier requests.
  await sql`UPDATE mto_players SET cooldowns=jsonb_set(cooldowns,'{flyers}',to_jsonb(now()+interval '1 hour')) WHERE id=${beginner}`;
  await assert.rejects(
    action(beginner, "activity", { id: "flyers" }),
    /cooling down/,
  );
});
await test("replayed action key changes money only once under concurrency", async () => {
  const before = await state(advanced),
    key = crypto.randomUUID();
  const results = await Promise.all([
    action(advanced, "deposit", { amount: 125 }, key),
    action(advanced, "deposit", { amount: 125 }, key),
  ]);
  assert.deepEqual(results[0], results[1]);
  const p = await state(advanced);
  assert.equal(p.cash, before.cash - 125);
  assert.equal(p.bank, before.bank + 125);
});
await test("invalid withdrawals roll back without changing balances", async () => {
  const p = await state(advanced);
  await assert.rejects(
    action(advanced, "withdraw", { amount: 999999 }),
    /Not enough savings/,
  );
  const after = await state(advanced);
  assert.equal(after.cash, p.cash);
  assert.equal(after.bank, p.bank);
  assert.equal(after.wins, p.wins);
  assert.equal(after.actions, p.actions);
});
await test("equipment can only be equipped when owned", async () => {
  await assert.rejects(action(beginner, "equip", { id: "suit" }), /do not own/);
  await action(advanced, "buyItem", { id: "boots" });
  const p = await action(advanced, "equip", { id: "boots" });
  assert.equal(p.player.power, 4);
  assert.ok(p.player.inventory[0].equipped);
});
await test("offline stamina recovery caps at the authoritative capacity", async () => {
  await sql`UPDATE mto_players SET energy=20,energy_at=now()-interval '100 minutes' WHERE id=${beginner}`;
  const p = await state(beginner);
  assert.equal(p.energy, 200);
});
await test("concurrent different-key activity requests allow only one outcome", async () => {
  const results = await Promise.allSettled([
    action(buyer, "activity", { id: "flyers" }),
    action(buyer, "activity", { id: "flyers" }),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
});
const asset = {
  id: crypto.randomUUID(),
  name: "Fixture Forward",
  position: "FWD",
  rarity: "Local",
  power: 10,
  value: 100,
};
await sql`UPDATE mto_players SET squad=${JSON.stringify([asset])}::jsonb WHERE id=${advanced}`;
await test("listing escrows a player and cancellation restores ownership", async () => {
  await action(advanced, "listPlayer", { id: asset.id, amount: 100 });
  assert.equal((await state(advanced)).squad.length, 0);
  const l = (
    await sql`SELECT id FROM mto_listings WHERE seller=${advanced} AND buyer IS NULL`
  )[0];
  await assert.rejects(
    action(buyer, "cancelListing", { id: l.id }),
    /Cannot withdraw/,
  );
  await action(advanced, "cancelListing", { id: l.id });
  assert.equal((await state(advanced)).squad[0].id, asset.id);
});
await test("two buyers cannot buy the same player; seller paid once", async () => {
  await action(advanced, "listPlayer", { id: asset.id, amount: 100 });
  const l = (
    await sql`SELECT id FROM mto_listings WHERE seller=${advanced} AND buyer IS NULL`
  )[0];
  const before = await state(advanced),
    other = await make(1500);
  const result = await Promise.allSettled([
    action(buyer, "buyListing", { id: l.id }),
    action(other, "buyListing", { id: l.id }),
  ]);
  assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await state(advanced)).cash, before.cash + 100);
  const squads = [...(await state(buyer)).squad, ...(await state(other)).squad];
  assert.equal(squads.filter((x) => x.id === asset.id).length, 1);
});
await test("rivals protect beginners and reject self challenges", async () => {
  await assert.rejects(
    action(advanced, "challenge", { target: beginner }),
    /protected/,
  );
  await assert.rejects(
    action(advanced, "challenge", { target: advanced }),
    /another manager/,
  );
});
await test("rate limiting rejects excess calls in the same window", async () => {
  const k = "fixture:" + crypto.randomUUID();
  assert.equal((await sql`SELECT mto_throttle(${k},1) AS ok`)[0].ok, true);
  assert.equal((await sql`SELECT mto_throttle(${k},1) AS ok`)[0].ok, false);
});
console.log(
  `${passed} integration tests passed. Fixtures remain only on the isolated verification branch.`,
);
