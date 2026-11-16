-- 009: Isolated business ownership and capped offline revenue.
-- Additive only: does not change existing player balances, sessions or game functions.
-- Apply to a disposable verification branch first. Do not run against the playable world
-- until integration tests and UI/API wiring are complete.
CREATE TABLE IF NOT EXISTS mto_business_types (
  id text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  purchase_price bigint NOT NULL CHECK (purchase_price > 0),
  income_per_hour bigint NOT NULL CHECK (income_per_hour >= 0),
  rank_required integer NOT NULL CHECK (rank_required >= 0)
);
INSERT INTO mto_business_types (id,title,description,purchase_price,income_per_hour,rank_required) VALUES
 ('programme','Matchday Programme Stall','Sell matchday programmes to supporters.',750,35,1),
 ('merchandise','Club Merchandise Shop','Build a local market for club colours.',4500,175,3),
 ('academy','Community Football Academy','Develop a grassroots coaching operation.',18000,650,6)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS mto_businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES mto_players(id) ON DELETE CASCADE,
  business_type text NOT NULL REFERENCES mto_business_types(id),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 10),
  accrued_at timestamptz NOT NULL DEFAULT now(),
  remainder_seconds integer NOT NULL DEFAULT 0 CHECK (remainder_seconds BETWEEN 0 AND 3599),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id,business_type)
);
CREATE INDEX IF NOT EXISTS mto_businesses_owner ON mto_businesses(player_id);

-- The first release has no upgrades. A maximum of 12 hours can be claimed per
-- collection, and whole-hour accounting prevents fractional-currency exploits.
-- Receipt keys ensure retries cannot pay twice. Row locks serialize claims.
CREATE OR REPLACE FUNCTION mto_business_purchase(
  pid uuid, request_key uuid, business_id text
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; b mto_business_types; prior jsonb; outcome jsonb;
BEGIN
  SELECT result INTO prior FROM mto_receipts WHERE player_id=pid AND key=request_key;
  IF FOUND THEN RETURN prior; END IF;
  SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
  SELECT result INTO prior FROM mto_receipts WHERE player_id=pid AND key=request_key;
  IF FOUND THEN RETURN prior; END IF;
  SELECT * INTO b FROM mto_business_types WHERE id=business_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown business'; END IF;
  IF mto_rank(p.xp)<b.rank_required THEN RAISE EXCEPTION 'Rank too low'; END IF;
  IF p.cash<b.purchase_price THEN RAISE EXCEPTION 'Not enough cash'; END IF;
  IF EXISTS (SELECT 1 FROM mto_businesses WHERE player_id=pid AND business_type=business_id)
  THEN RAISE EXCEPTION 'Business already owned'; END IF;
  INSERT INTO mto_businesses(player_id,business_type) VALUES(pid,business_id);
  UPDATE mto_players SET cash=cash-b.purchase_price WHERE id=pid;
  INSERT INTO mto_events(player_id,kind,message,cash_delta)
    VALUES(pid,'business','Purchased '||b.title,-b.purchase_price);
  outcome:=jsonb_build_object('success',true,'message','Purchased '||b.title,'cashDelta',-b.purchase_price);
  INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,outcome);
  RETURN outcome;
END $$;

CREATE OR REPLACE FUNCTION mto_business_claim(
  pid uuid, request_key uuid, owned_id uuid
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; owned mto_businesses; rate bigint;
  prior jsonb; outcome jsonb; elapsed bigint; eligible bigint;
  hours_earned bigint; payment bigint; next_remainder integer;
BEGIN
  SELECT result INTO prior FROM mto_receipts WHERE player_id=pid AND key=request_key;
  IF FOUND THEN RETURN prior; END IF;
  SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
  SELECT result INTO prior FROM mto_receipts WHERE player_id=pid AND key=request_key;
  IF FOUND THEN RETURN prior; END IF;
  SELECT * INTO owned FROM mto_businesses WHERE id=owned_id AND player_id=pid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Business not found'; END IF;
  SELECT income_per_hour INTO STRICT rate FROM mto_business_types WHERE id=owned.business_type;
  elapsed:=greatest(0,floor(extract(epoch FROM (now()-owned.accrued_at)))::bigint);
  eligible:=least(elapsed,43200);
  hours_earned:=(eligible+owned.remainder_seconds)/3600;
  next_remainder:=((eligible+owned.remainder_seconds)%3600)::integer;
  payment:=hours_earned*rate*owned.level;
  -- Always advance collection clock, including zero-payment claims. Discard
  -- time beyond 12h instead of accumulating unbounded unattended income.
  UPDATE mto_businesses SET accrued_at=now(),remainder_seconds=next_remainder WHERE id=owned.id;
  IF payment>0 THEN
    UPDATE mto_players SET cash=cash+payment WHERE id=pid;
    INSERT INTO mto_events(player_id,kind,message,cash_delta)
      VALUES(pid,'business','Collected business earnings',payment);
  END IF;
  outcome:=jsonb_build_object('success',true,'message',
    CASE WHEN payment>0 THEN 'Business earnings collected' ELSE 'No full hour of earnings yet' END,
    'cashDelta',payment,'hours',hours_earned);
  INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,outcome);
  RETURN outcome;
END $$;
