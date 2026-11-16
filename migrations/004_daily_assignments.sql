-- Additive daily assignments. UTC midnight reset; no hidden rank rewards.
CREATE TABLE mto_daily_claims (
 player_id uuid NOT NULL REFERENCES mto_players(id),
 day date NOT NULL,
 goal text NOT NULL CHECK(goal IN ('shift','savings','profit')),
 claimed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(player_id,day,goal)
);
CREATE INDEX mto_events_daily ON mto_events(player_id,created_at);
CREATE FUNCTION mto_daily(pid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH clock AS (SELECT (now() AT TIME ZONE 'UTC')::date AS day),
 progress AS (
 SELECT count(*) FILTER(WHERE kind='activity')::int AS moves,
 count(*) FILTER(WHERE kind='deposit')::int AS deposits,
 count(*) FILTER(WHERE kind='activity' AND cash_delta>0)::int AS profits
 FROM mto_events,clock WHERE player_id=pid
 AND created_at >= (clock.day::timestamp AT TIME ZONE 'UTC')
 AND created_at < ((clock.day+1)::timestamp AT TIME ZONE 'UTC')
 ), goals AS (
 SELECT 'shift' AS id,'Put in a shift' AS title,'Complete 5 activities. Successful and unsuccessful attempts count.' AS description,5 AS target,moves AS progress,40 AS reward FROM progress
 UNION ALL SELECT 'savings','Safe hands','Make one deposit into the club bank.',1,deposits,25 FROM progress
 UNION ALL SELECT 'profit','Good business','Complete 3 activities with a positive cash return after entry costs.',3,profits,75 FROM progress
 )
 SELECT jsonb_build_object('day',clock.day,'resetsAt',((clock.day+1)::timestamp AT TIME ZONE 'UTC'),
 'goals',(SELECT jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'description',g.description,'target',g.target,'progress',least(g.target,g.progress),'reward',g.reward,'claimed',EXISTS(SELECT 1 FROM mto_daily_claims c WHERE c.player_id=pid AND c.day=clock.day AND c.goal=g.id)) ORDER BY g.id) FROM goals g)) FROM clock
$$;
CREATE FUNCTION mto_claim_daily(pid uuid,request_key uuid,goal_id text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; old_result jsonb; status jsonb; goal jsonb; result jsonb; today date; reward integer; msg text;
BEGIN
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
 SELECT r.result INTO old_result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;
 IF FOUND THEN RETURN old_result; END IF;
 status:=mto_daily(pid); today:=(status->>'day')::date;
 SELECT g INTO goal FROM jsonb_array_elements(status->'goals')g WHERE g->>'id'=goal_id;
 IF goal IS NULL THEN RAISE EXCEPTION 'Unknown daily assignment'; END IF;
 IF (goal->>'claimed')::boolean THEN RAISE EXCEPTION 'You already claimed this assignment today'; END IF;
 IF (goal->>'progress')::int < (goal->>'target')::int THEN RAISE EXCEPTION 'Complete the daily assignment first'; END IF;
 reward:=(goal->>'reward')::int;
 INSERT INTO mto_daily_claims(player_id,day,goal) VALUES(pid,today,goal_id);
 p:=mto_refresh(pid);
 UPDATE mto_players SET cash=cash+reward WHERE id=pid RETURNING * INTO p;
 msg:='Daily assignment: '||(goal->>'title')||'. Earned £'||reward;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(pid,'daily',msg,reward);
 result:=jsonb_build_object('success',true,'message',msg,'cashDelta',reward,'player',mto_public(p),'serverTime',now());
 INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,result);
 RETURN result;
END $$;
INSERT INTO mto_migrations(version) VALUES(4);
