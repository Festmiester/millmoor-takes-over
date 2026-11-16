import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const database = readFileSync(".env.integration", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)![1];
const live = readFileSync(".dev.vars.test", "utf8").match(
  /^DATABASE_URL=(.+)$/m,
)![1];
assert.notEqual(new URL(database).hostname, new URL(live).hostname);
const sql = neon(database);
const rows =
  await sql`INSERT INTO mto_players(identity,name,club,xp,cash,squad) SELECT ${"fixture:scouting-" + crypto.randomUUID()},'Scouting QA','Scouting QA FC',1500,100000,jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','Existing '||n,'position','DEF','rarity','Local','power',5,'value',100)) FROM generate_series(1,29)n RETURNING id`;
const pid = rows[0].id;
assert.match(pid, /^[0-9a-f-]{36}$/);
await sql.query(
  `DO $$
DECLARE p uuid := '${pid}'::uuid; k uuid; r jsonb; replay jsonb; a jsonb; counts integer; before_cash bigint; listing_id uuid;
BEGIN
 FOR attempt IN 1..60 LOOP
 UPDATE mto_players SET cooldowns='{}',energy=100 WHERE id=p;
 k:=gen_random_uuid();r:=mto_action(p,k,'activity','{"id":"scout","approach":"safe"}');
 EXIT WHEN (r->>'success')::boolean;
 END LOOP;
 IF NOT (r->>'success')::boolean THEN RAISE EXCEPTION 'No successful scout in 60 attempts'; END IF;
 a:=r->'acquiredPlayer';
 IF a IS NULL OR (a->>'age')::int NOT BETWEEN 17 AND 33 OR (a->>'power')::int NOT BETWEEN 5 AND 14 OR a->>'rarity' NOT IN ('Local','Promising','Elite','Legendary') THEN RAISE EXCEPTION 'Invalid acquired player metadata'; END IF;
 IF (a->>'value')::int < 90 THEN RAISE EXCEPTION 'Invalid player value'; END IF;
 IF (r->'player'->>'ownedCount')::int<>30 THEN RAISE EXCEPTION 'Wrong owned count'; END IF;
 replay:=mto_action(p,k,'activity','{"id":"scout","approach":"safe"}');
 IF r IS DISTINCT FROM replay THEN RAISE EXCEPTION 'Full-roster replay did not return original receipt'; END IF;
 SELECT cash INTO before_cash FROM mto_players WHERE id=p;
 BEGIN
 PERFORM mto_action(p,gen_random_uuid(),'activity','{"id":"scout"}');
 RAISE EXCEPTION 'Capacity check missing';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Squad capacity%' THEN RAISE; END IF; END;
 IF (SELECT cash FROM mto_players WHERE id=p)<>before_cash THEN RAISE EXCEPTION 'Blocked scout charged cash'; END IF;
 PERFORM mto_action(p,gen_random_uuid(),'listPlayer',jsonb_build_object('id',a->>'id','amount',100));
 IF (mto_public((SELECT x FROM mto_players x WHERE x.id=p))->>'ownedCount')::int<>30 THEN RAISE EXCEPTION 'Listed asset escaped capacity'; END IF;
 BEGIN
 PERFORM mto_action(p,gen_random_uuid(),'activity','{"id":"scout"}');
 RAISE EXCEPTION 'Listed capacity check missing';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Squad capacity%' THEN RAISE; END IF; END;
 SELECT id INTO listing_id FROM mto_listings WHERE seller=p AND buyer IS NULL;
 PERFORM mto_action(p,gen_random_uuid(),'cancelListing',jsonb_build_object('id',listing_id));
 SELECT jsonb_array_length(squad) INTO counts FROM mto_players WHERE id=p;
 IF counts<>30 THEN RAISE EXCEPTION 'Cancellation lost an owned player'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements((SELECT squad FROM mto_players WHERE id=p))x WHERE x->>'name' LIKE 'Existing %')<>29 THEN RAISE EXCEPTION 'Legacy roster changed'; END IF;
END $$`,
  [],
);
console.log("PASS real scouting adds rarity, age, power and value");
console.log("PASS full roster rejects acquisitions without charging");
console.log("PASS full-roster replay returns the same receipt");
console.log(
  "PASS listed players count toward capacity; cancelling returns ownership",
);
console.log("PASS all 29 legacy assets preserved");
const profiles =
  await sql`SELECT t,mto_scout_profile(t) AS profile FROM generate_series(1,5)t`;
assert.equal(profiles.length, 5);
for (const row of profiles) {
  const p = row.profile;
  assert.equal(p.capacity, 30);
  assert.ok(p.local + p.promising + p.elite + p.legendary > 0);
}
console.log("PASS five server-provided rarity profiles are valid");
