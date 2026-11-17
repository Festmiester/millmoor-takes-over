import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
const url = (file: string) =>
  readFileSync(file, "utf8").match(/^DATABASE_URL=(.+)$/m)![1];
assert.notEqual(
  new URL(url(".env.integration")).hostname,
  new URL(url(".dev.vars.test")).hostname,
);
const sql = neon(url(".env.integration"));
const ps =
  await sql`INSERT INTO mto_players(identity,name,club,xp,cash) SELECT 'fixture:'||gen_random_uuid(),'Pacing '||n,'Pacing FC '||n,1500,100000 FROM generate_series(1,3)n RETURNING id`;
const [a, b, c] = ps.map((p) => p.id as string);
let passed = 0;
async function check(name: string, run: () => Promise<void>) {
  await run();
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
await check(
  "stamina starts at 200, recovers every 30 seconds and grows with fitness",
  async () => {
    assert.equal(
      (await sql`SELECT energy FROM mto_players WHERE id=${a}::uuid`)[0].energy,
      200,
    );
    await sql`UPDATE mto_players SET energy=10,energy_at=now()-interval '61 seconds' WHERE id=${a}::uuid`;
    const p = (await sql`SELECT mto_public(mto_refresh(${a}::uuid)) AS p`)[0].p;
    assert.equal(p.energy, 20);
    assert.equal(p.energyMax, 200);
    assert.equal(p.energyRegen, 5);
    assert.equal(p.energyInterval, 30);
    await sql`UPDATE mto_players SET attributes=jsonb_set(attributes,'{fitness}','40'),energy_at=now()-interval '1 day' WHERE id=${a}::uuid`;
    const trained = (
      await sql`SELECT mto_public(mto_refresh(${a}::uuid)) AS p`
    )[0].p;
    assert.equal(trained.energy, 300);
    assert.equal(trained.energyMax, 300);
  },
);
const assets = [1, 2, 3].map((n) => ({
  id: crypto.randomUUID(),
  name: "Crew " + n,
  position: "MID",
  power: n * 10,
  value: 100,
  rarity: "Local",
}));
await sql`UPDATE mto_players SET squad=${JSON.stringify(assets)}::jsonb WHERE id=${a}::uuid`;
await check(
  "solo ventures reject duplicate, foreign and missing players without a charge",
  async () => {
    await assert.rejects(
      act(a, "soloVenture", {
        players: [assets[0].id, assets[0].id, assets[1].id],
      }),
      /three different/,
    );
    await assert.rejects(
      act(b, "soloVenture", { players: assets.map((p) => p.id) }),
      /Only your available/,
    );
    await assert.rejects(
      act(a, "soloVenture", { players: [] }),
      /three different/,
    );
    assert.equal(
      Number(
        (await sql`SELECT cash FROM mto_players WHERE id=${a}::uuid`)[0].cash,
      ),
      100000,
    );
  },
);
await check(
  "solo outcome persists once with eight-hour manager and asset fatigue",
  async () => {
    const key = crypto.randomUUID();
    const input = { players: assets.map((p) => p.id) };
    const r = await act(a, "soloVenture", input, key);
    assert.equal(r.cashDelta, r.success ? 3750 : -750);
    assert.deepEqual(await act(a, "soloVenture", input, key), r);
    const due =
      Date.parse(r.player.cooldowns.venture) - Date.parse(r.serverTime);
    assert.equal(due, 8 * 3600000);
    assert.equal((await state(a)).crewDuties.length, 3);
    await assert.rejects(act(a, "soloVenture", input), /cooling down/);
  },
);
await check(
  "asset fatigue follows transferred players and cannot be bypassed",
  async () => {
    await sql`UPDATE mto_players SET squad=${JSON.stringify(assets)}::jsonb WHERE id=${b}::uuid`;
    await assert.rejects(
      act(b, "soloVenture", { players: assets.map((p) => p.id) }),
      /still recovering/,
    );
    await sql`UPDATE mto_players SET squad='[]' WHERE id=${b}::uuid`;
  },
);
await check(
  "public human ventures support same-location managers without an alliance",
  async () => {
    await act(b, "createVenture");
    const v = (await state(b)).ventures.find(
      (v: any) => v.host === b && v.status === "open",
    );
    await sql`UPDATE mto_players SET region='Sheffield' WHERE id=${c}::uuid`;
    assert.equal(
      (await state(c)).ventures.some((x: any) => x.id === v.id),
      false,
    );
    await assert.rejects(act(c, "joinVenture", { id: v.id }), /Travel/);
    await sql`UPDATE mto_players SET region='Rotherham' WHERE id=${c}::uuid`;
    await act(c, "joinVenture", { id: v.id });
    await act(b, "readyVenture", { id: v.id });
    await act(c, "readyVenture", { id: v.id });
    const r = await act(b, "resolveVenture", { id: v.id });
    assert.equal(r.cashDelta, r.success ? 7500 : -500);
    assert.equal(
      Date.parse(r.player.cooldowns.venture) - Date.parse(r.serverTime),
      8 * 3600000,
    );
  },
);
let topic: string;
await check(
  "regional board topics, replies and duplicate receipts are saved without rewards",
  async () => {
    const key = crypto.randomUUID();
    const input = {
      category: "questions",
      title: "Fixture " + crypto.randomUUID().slice(0, 8),
      body: "How do I find a venture?",
    };
    const before = (
      await sql`SELECT cash,xp,energy FROM mto_players WHERE id=${b}::uuid`
    )[0];
    const r = await act(b, "boardPost", input, key);
    assert.equal(r.cashDelta, 0);
    assert.deepEqual(await act(b, "boardPost", input, key), r);
    topic = (await state(b)).board.find((p: any) => p.title === input.title).id;
    await act(c, "boardPost", {
      parent: topic,
      body: "Use the Venture Classifieds.",
    });
    assert.ok((await state(b)).board.some((p: any) => p.parentId === topic));
    const after = (
      await sql`SELECT cash,xp FROM mto_players WHERE id=${b}::uuid`
    )[0];
    assert.equal(after.cash, before.cash);
    assert.equal(after.xp, before.xp);
  },
);
await check(
  "board location, post limits and author-only removal are enforced",
  async () => {
    await sql`UPDATE mto_players SET region='Sheffield' WHERE id=${a}::uuid`;
    assert.equal(
      (await state(a)).board.some((p: any) => p.id === topic),
      false,
    );
    await assert.rejects(
      act(a, "boardPost", { parent: topic, body: "Remote reply" }),
      /not available in your location/,
    );
    await assert.rejects(
      act(c, "removeBoardPost", { id: topic }),
      /Only the author/,
    );
    // Same database transaction fixes the server clock; network latency must
    // not turn a rate-limit assertion into a legitimate later post.
    await assert.rejects(
      sql.transaction([
        sql`UPDATE mto_board_posts SET created_at=now() WHERE id=${topic}::uuid`,
        sql`SELECT mto_empire_action(${b}::uuid,${crypto.randomUUID()}::uuid,'boardPost','{"category":"chat","title":"Chat","body":"Too soon"}'::jsonb)`,
      ]),
      /eight seconds/,
    );
    await act(b, "removeBoardPost", { id: topic });
    assert.equal(
      (await state(c)).board.some(
        (p: any) => p.parentId === topic || p.id === topic,
      ),
      false,
    );
  },
);
await check(
  "all office approaches have intentional positive fresh cash expectation",
  async () => {
    const rows =
      await sql`SELECT * FROM mto_activities WHERE category='office'`;
    for (const a of rows)
      for (const mode of ["safe", "steady", "bold"]) {
        const chance = Math.max(
          10,
          Math.min(
            95,
            a.chance + (mode === "safe" ? 10 : mode === "bold" ? -10 : 0),
          ),
        );
        const gross = Math.floor(
          a.reward * (mode === "safe" ? 0.8 : mode === "bold" ? 1.3 : 1),
        );
        const expected = (chance / 100) * gross - a.cost;
        assert.ok(expected > 0, a.id + " " + mode + " " + expected);
      }
  },
);
await check(
  "practice is monotonic, capped, diminishing and replay-safe",
  async () => {
    const pid = c;
    await sql`UPDATE mto_players SET cooldowns='{}',energy=200 WHERE id=${pid}::uuid`;
    const key = crypto.randomUUID();
    const r = (
      await sql`SELECT mto_action(${pid}::uuid,${key}::uuid,'activity','{"id":"flyers"}'::jsonb) AS r`
    )[0].r;
    const first = Number(
      (
        await sql`SELECT practice FROM mto_practice WHERE player_id=${pid}::uuid AND activity_id='flyers'`
      )[0].practice,
    );
    assert.equal(first, r.success ? 1 : 0.5);
    await sql`SELECT mto_action(${pid}::uuid,${key}::uuid,'activity','{"id":"flyers"}'::jsonb)`;
    assert.equal(
      Number(
        (
          await sql`SELECT practice FROM mto_practice WHERE player_id=${pid}::uuid AND activity_id='flyers'`
        )[0].practice,
      ),
      first,
    );
    const values = [];
    for (const value of [0, 80, 160, 10000]) {
      await sql`UPDATE mto_practice SET practice=${value} WHERE player_id=${pid}::uuid AND activity_id='flyers'`;
      values.push(
        (
          await sql`SELECT mto_public(p)->'mastery'->>'flyers' AS bonus FROM mto_players p WHERE id=${pid}::uuid`
        )[0].bonus,
      );
    }
    assert.ok(
      Number(values[1]) - Number(values[0]) >
        Number(values[2]) - Number(values[1]),
    );
    assert.ok(Number(values[3]) <= 30);
  },
);
await check(
  "training attributes affect real returned club power and stamina capacity",
  async () => {
    const [row] =
      await sql`INSERT INTO mto_players(identity,name,club,xp,cash) VALUES(${"fixture:" + crypto.randomUUID()},'Training Pacing','Training Pacing FC',1500,10000) RETURNING id`;
    let before = (
      await sql`SELECT mto_public(p) AS p FROM mto_players p WHERE id=${row.id}::uuid`
    )[0].p;
    for (const [stat, powerGain] of [
      ["leadership", 1],
      ["focus", 1],
      ["resilience", 2],
      ["fitness", 0],
    ] as const) {
      await sql`UPDATE mto_players SET cooldowns=cooldowns-'training' WHERE id=${row.id}::uuid`;
      const after = (
        await sql`SELECT mto_action(${row.id}::uuid,${crypto.randomUUID()}::uuid,'train',${JSON.stringify({ stat })}::jsonb) AS r`
      )[0].r.player;
      assert.equal(after.power - before.power, powerGain);
      if (stat === "fitness")
        assert.equal(after.energyMax - before.energyMax, 5);
      before = after;
    }
  },
);
await check(
  "a partnered venture cannot be abandoned through the solo route",
  async () => {
    await sql`INSERT INTO mto_ventures(host,partner,region) VALUES(${b}::uuid,${c}::uuid,'Rotherham')`;
    await assert.rejects(
      act(b, "soloVenture", { players: assets.map((p) => p.id) }),
      /Cancel or complete your partnered/,
    );
  },
);
console.log(
  `${passed} pacing, squad and board checks passed on verification only.`,
);
