-- Run against a disposable Neon branch only, not the playable database.
-- psql -v ON_ERROR_STOP=1 -f scripts/business-smoke.sql
-- The entire test is rolled back so it does not retain test players.
BEGIN;
DO $test$
DECLARE
  pid uuid; other_pid uuid; k uuid := gen_random_uuid();
  receipt jsonb; replay jsonb; state jsonb;
  opening_cash bigint; after_purchase bigint;
BEGIN
  INSERT INTO mto_players(identity,name,club,cash,xp)
  VALUES ('business-smoke:'||gen_random_uuid(),'Smoke Manager','Smoke Club',10000,1000000000)
  RETURNING id INTO pid;
  INSERT INTO mto_players(identity,name,club,cash,xp)
  VALUES ('business-smoke:'||gen_random_uuid(),'Other Manager','Smoke Club',10000,1000000000)
  RETURNING id INTO other_pid;

  SELECT cash INTO opening_cash FROM mto_players WHERE id=pid;
  receipt:=mto_business_action(pid,k,'buyBusiness','programmes');
  SELECT cash INTO after_purchase FROM mto_players WHERE id=pid;
  IF after_purchase<>opening_cash-180 THEN RAISE EXCEPTION 'Purchase debit mismatch'; END IF;
  replay:=mto_business_action(pid,k,'buyBusiness','programmes');
  IF replay<>receipt THEN RAISE EXCEPTION 'Duplicate purchase key changed receipt'; END IF;
  IF (SELECT count(*) FROM mto_businesses WHERE player_id=pid AND business_id='programmes')<>1
  THEN RAISE EXCEPTION 'Duplicate ownership'; END IF;

  UPDATE mto_businesses SET collected_at=now()-interval '30 minutes'
  WHERE player_id=pid AND business_id='programmes';
  k:=gen_random_uuid();
  receipt:=mto_business_action(pid,k,'collectBusiness','programmes');
  IF (receipt->>'cashDelta')::int<>12 THEN RAISE EXCEPTION 'Wrong 30-minute payout'; END IF;
  replay:=mto_business_action(pid,k,'collectBusiness','programmes');
  IF replay<>receipt THEN RAISE EXCEPTION 'Duplicate collection key changed receipt'; END IF;

  UPDATE mto_businesses SET collected_at=now()-interval '30 hours'
  WHERE player_id=pid AND business_id='programmes';
  receipt:=mto_business_action(pid,gen_random_uuid(),'collectBusiness','programmes');
  IF (receipt->>'cashDelta')::int<>192 THEN RAISE EXCEPTION '8-hour cap failed'; END IF;

  -- Upgrade settles earnings at the previous rate, then charges the upgrade.
  UPDATE mto_businesses SET collected_at=now()-interval '20 minutes'
  WHERE player_id=pid AND business_id='programmes';
  receipt:=mto_business_action(pid,gen_random_uuid(),'upgradeBusiness','programmes');
  IF (receipt->>'cashDelta')::int<>-352 THEN RAISE EXCEPTION 'Upgrade settlement failed'; END IF;
  IF (SELECT level FROM mto_businesses WHERE player_id=pid AND business_id='programmes')<>2
  THEN RAISE EXCEPTION 'Upgrade level failed'; END IF;

  state:=mto_business_status(pid);
  IF (state->>'tickSeconds')::int<>600 OR (state->>'capTicks')::int<>48
  THEN RAISE EXCEPTION 'Unexpected economy cycle settings'; END IF;
  IF jsonb_array_length(state->'businesses')<>3
  THEN RAISE EXCEPTION 'Catalog size changed'; END IF;

  -- Unauthorized collection must fail, without changing either balance.
  BEGIN
    PERFORM mto_business_action(other_pid,gen_random_uuid(),'collectBusiness','programmes');
    RAISE EXCEPTION 'Cross-account collection unexpectedly succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM='Cross-account collection unexpectedly succeeded' THEN RAISE; END IF;
  END;

  RAISE NOTICE 'PASS: purchase, replay, 30-minute income, collection replay, 8-hour cap, upgrade settlement, catalog, account isolation';
END $test$;
ROLLBACK;
