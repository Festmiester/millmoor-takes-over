import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const url = (f: string) =>
  readFileSync(f, "utf8").match(/^DATABASE_URL=(.+)$/m)![1];
assert.notEqual(
  new URL(url(".env.integration")).hostname,
  new URL(url(".dev.vars.test")).hostname,
);
assert.equal(new URL(url(".env.integration")).pathname, "/takes_over");
const sql = neon(url(".env.integration"));
const players =
  await sql`INSERT INTO mto_players(identity,name,club,xp,cash) SELECT 'fixture:'||gen_random_uuid(),'Empire Test '||n,'Empire Test FC '||n,2000,100000 FROM generate_series(1,3)n RETURNING id`;
const [a, b, c] = players.map((p) => p.id as string);
let passed = 0;
async function check(name: string, fn: () => Promise<void>) {
  await fn();
  console.log("PASS", name);
  passed++;
}
async function act(
  pid: string,
  kind: string,
  input: Record<string, unknown> = {},
  key = crypto.randomUUID(),
) {
  return (
    await sql`SELECT mto_empire_action(${pid}::uuid,${key}::uuid,${kind},${JSON.stringify(input)}::jsonb) AS r`
  )[0].r;
}
async function state(pid: string) {
  return (await sql`SELECT mto_empire_status(${pid}::uuid) AS s`)[0].s;
}
await check("business purchase and receipt replay charge once", async () => {
  const key = crypto.randomUUID();
  const r = await act(a, "buyBusiness", { id: "programmes" }, key);
  assert.equal(r.cashDelta, -180);
  assert.deepEqual(await act(a, "buyBusiness", { id: "programmes" }, key), r);
  await assert.rejects(
    act(a, "buyBusiness", { id: "programmes" }),
    /already own/,
  );
  await assert.rejects(
    act(b, "collectBusiness", { id: "programmes" }),
    /Open this business/,
  );
  await assert.rejects(
    act(a, "collectBusiness", { id: "programmes" }),
    /not ready/,
  );
});
await check(
  "offline business cap and concurrent collection pay once",
  async () => {
    await sql`UPDATE mto_businesses SET collected_at=now()-interval '2 days' WHERE player_id=${a}::uuid`;
    assert.equal((await state(a)).business.businesses[0].available, 192);
    const rs = await Promise.allSettled([
      act(a, "collectBusiness", { id: "programmes" }),
      act(a, "collectBusiness", { id: "programmes" }),
    ]);
    assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      (rs.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>)
        .value.cashDelta,
      192,
    );
  },
);
await check(
  "business upgrade settles old rate without retroactive earnings",
  async () => {
    await sql`UPDATE mto_businesses SET collected_at=now()-interval '20 minutes' WHERE player_id=${a}::uuid`;
    assert.equal(
      (await act(a, "upgradeBusiness", { id: "programmes" })).cashDelta,
      8 - 360,
    );
    const bs = (await state(a)).business.businesses[0];
    assert.equal(bs.level, 2);
    assert.equal(bs.rate, 8);
    assert.equal(bs.available, 0);
  },
);
await check(
  "regional merchandise uses server quotes and independent stock",
  async () => {
    const g = (await state(a)).trade.goods.find((g: any) => g.id === "scarves");
    assert.equal(g.buy - g.sell, 3);
    assert.equal(g.owned, 0);
    assert.equal(
      (await act(a, "buyGoods", { id: "scarves", quantity: 20 })).cashDelta,
      -20 * g.buy,
    );
    assert.equal(
      (await state(a)).trade.goods.find((g: any) => g.id === "scarves").owned,
      20,
    );
    assert.equal(
      (await state(b)).trade.goods.find((g: any) => g.id === "scarves").owned,
      0,
    );
    await assert.rejects(
      act(a, "sellGoods", { id: "scarves", quantity: 5 }),
      /cooling down/,
    );
    await sql`UPDATE mto_players SET cooldowns=cooldowns-'trade' WHERE id=${a}::uuid`;
    assert.equal(
      (await act(a, "sellGoods", { id: "scarves", quantity: 5 })).cashDelta,
      5 * g.sell,
    );
  },
);
await check(
  "trading rejects excess storage, foreign stock and invalid quantities",
  async () => {
    await sql`UPDATE mto_players SET cooldowns=cooldowns-'trade' WHERE id=${a}::uuid`;
    await sql`UPDATE mto_stock SET quantity=100 WHERE player_id=${a}::uuid`;
    await assert.rejects(
      act(a, "buyGoods", { id: "shirts", quantity: 1 }),
      /storage is full/,
    );
    await assert.rejects(
      act(b, "sellGoods", { id: "scarves", quantity: 1 }),
      /Not enough merchandise/,
    );
    await assert.rejects(
      act(b, "buyGoods", { id: "shirts", quantity: 0 }),
      /1 to 20/,
    );
  },
);
let aid: string;
await check(
  "alliances persist, charge once, enforce unique membership and names",
  async () => {
    const key = crypto.randomUUID();
    const name = "Test " + crypto.randomUUID().slice(0, 8);
    const r = await act(a, "createAlliance", { name }, key);
    assert.equal(r.cashDelta, -250);
    assert.deepEqual(await act(a, "createAlliance", { name }, key), r);
    aid = (await state(a)).alliances.find((x: any) => x.joined).id;
    await act(b, "joinAlliance", { id: aid });
    await assert.rejects(act(b, "joinAlliance", { id: aid }), /already belong/);
    await assert.rejects(act(c, "createAlliance", { name }), /name is taken/);
    assert.equal((await state(a)).members.length, 2);
  },
);
let mid: string;
await check(
  "mail and alliance messages remain private to their participants",
  async () => {
    await act(a, "sendMessage", { target: b, body: "Private fixture message" });
    await act(a, "allianceMessage", { body: "Alliance fixture message" });
    const inbox = (await state(b)).messages;
    assert.equal(inbox.length, 2);
    assert.equal((await state(c)).messages.length, 0);
    mid = inbox.find((m: any) => m.recipient === b).id;
    await assert.rejects(
      act(c, "readMessage", { id: mid }),
      /not in your inbox/,
    );
    await act(b, "readMessage", { id: mid });
    assert.ok((await state(b)).messages.find((m: any) => m.id === mid).readAt);
    await assert.rejects(
      act(c, "allianceMessage", { body: "No membership" }),
      /Join an alliance/,
    );
  },
);
let vid: string;
await check(
  "joint ventures require membership, two participants and explicit readiness",
  async () => {
    await assert.rejects(act(c, "createVenture"), /Join an alliance/);
    await act(a, "createVenture");
    vid = (await state(a)).ventures.find((v: any) => v.status === "open").id;
    await assert.rejects(act(a, "joinVenture", { id: vid }), /participants/);
    await act(b, "joinVenture", { id: vid });
    await assert.rejects(
      act(a, "resolveVenture", { id: vid }),
      /both managers are ready/,
    );
    await act(a, "readyVenture", { id: vid });
    await act(b, "readyVenture", { id: vid });
  },
);
await check(
  "venture rechecks both balances atomically before any charge",
  async () => {
    const before = (
      await sql`SELECT cash,energy FROM mto_players WHERE id=${a}::uuid`
    )[0];
    await sql`UPDATE mto_players SET cash=0 WHERE id=${b}::uuid`;
    await assert.rejects(
      act(a, "resolveVenture", { id: vid }),
      /Both clubs need/,
    );
    const after = (
      await sql`SELECT cash,energy FROM mto_players WHERE id=${a}::uuid`
    )[0];
    assert.deepEqual(after, before);
    await sql`UPDATE mto_players SET cash=100000 WHERE id=${b}::uuid`;
  },
);
await check(
  "concurrent venture resolution produces one shared payout and one receipt",
  async () => {
    const before =
      await sql`SELECT id,cash,xp,energy FROM mto_players WHERE id IN (${a}::uuid,${b}::uuid)`;
    const keys = [crypto.randomUUID(), crypto.randomUUID()];
    const rs = await Promise.allSettled(
      keys.map((key) => act(a, "resolveVenture", { id: vid }, key)),
    );
    assert.equal(rs.filter((r) => r.status === "fulfilled").length, 1);
    const index = rs.findIndex((r) => r.status === "fulfilled");
    const r = (rs[index] as PromiseFulfilledResult<any>).value;
    assert.deepEqual(
      await act(a, "resolveVenture", { id: vid }, keys[index]),
      r,
    );
    const after =
      await sql`SELECT id,cash,xp,energy,cooldowns FROM mto_players WHERE id IN (${a}::uuid,${b}::uuid)`;
    for (const p of after) {
      const old = before.find((x) => x.id === p.id)!;
      assert.equal(Number(p.cash) - Number(old.cash), r.success ? 320 : -80);
      assert.equal(Number(p.xp) - Number(old.xp), r.success ? 550 : 25);
      assert.equal(p.energy, old.energy - 10);
      assert.ok(p.cooldowns.venture);
    }
    assert.equal(
      (await state(b)).ventures.find((v: any) => v.id === vid).status,
      "complete",
    );
  },
);
await check(
  "leaving an alliance cancels waiting ventures and transfers ownership",
  async () => {
    await act(a, "createVenture");
    await act(a, "leaveAlliance");
    const s = await state(b);
    assert.equal(s.alliances.find((a: any) => a.joined).owner, b);
    assert.ok(s.ventures.some((v: any) => v.status === "cancelled"));
    assert.equal((await state(a)).members.length, 0);
    assert.equal(
      (await state(a)).messages.filter((m: any) => m.allianceId).length,
      0,
    );
  },
);
await check(
  "plain text limits and sender daily cap are enforced in the database",
  async () => {
    await assert.rejects(
      act(c, "sendMessage", { target: b, body: "<script>" }),
      /plain text/,
    );
    await sql`INSERT INTO mto_messages(sender,recipient,body) SELECT ${c}::uuid,${b}::uuid,'Daily cap fixture' FROM generate_series(1,100)`;
    await assert.rejects(
      act(c, "sendMessage", { target: b, body: "Too many" }),
      /Daily message limit/,
    );
  },
);
console.log(
  `${passed} empire integration checks passed on the verification database only.`,
);
