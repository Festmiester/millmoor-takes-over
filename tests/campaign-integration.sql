DO $$
DECLARE pid uuid; full_id uuid; end_id uuid; k uuid; result jsonb; again jsonb; status jsonb; before_xp bigint; before_cash bigint; first_asset uuid; reserved_id uuid; errmsg text; i integer;
BEGIN
 IF current_database()<>'takes_over' THEN RAISE EXCEPTION 'Wrong database';END IF;
 INSERT INTO mto_players(identity,name,club,xp,cash,chapter) VALUES('fixture:'||gen_random_uuid(),'Guided Test','Guided Test FC',1500,10000,6) RETURNING id INTO pid;
 status:=mto_campaign_status(pid);
 IF jsonb_array_length(status->'chapters')<>18 OR (status->>'current')::int<>1 OR (status->>'legacyCompleted')::int<>6 THEN RAISE EXCEPTION 'Initial guide or legacy count incorrect';END IF;
 BEGIN PERFORM mto_action(pid,gen_random_uuid(),'chapter','{"id":"1"}');RAISE EXCEPTION 'Unmet chapter paid';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS errmsg=MESSAGE_TEXT;IF position('Complete the guided' IN errmsg)=0 THEN RAISE;END IF;END;
 FOR i IN 1..3 LOOP
  UPDATE mto_players SET cooldowns='{}' WHERE id=pid;
  PERFORM mto_action(pid,gen_random_uuid(),'activity',jsonb_build_object('id','flyers','approach',CASE WHEN i=1 THEN 'safe' ELSE 'steady' END));
 END LOOP;
 FOR i IN 1..2 LOOP UPDATE mto_players SET cooldowns='{}' WHERE id=pid;PERFORM mto_action(pid,gen_random_uuid(),'activity','{"id":"coaching"}');END LOOP;
 status:=mto_campaign_status(pid);IF NOT (status->'chapters'->0->>'ready')::boolean THEN RAISE EXCEPTION 'Real starter actions not counted';END IF;
 SELECT xp,cash INTO before_xp,before_cash FROM mto_players WHERE id=pid;k:=gen_random_uuid();
 result:=mto_action(pid,k,'chapter','{"id":"1"}');again:=mto_action(pid,k,'chapter','{"id":"1"}');
 IF result<>again OR (result->>'cashDelta')::int<>100 THEN RAISE EXCEPTION 'Chapter receipt replay mismatch';END IF;
 IF (SELECT xp FROM mto_players WHERE id=pid)<>before_xp OR (SELECT chapter FROM mto_players WHERE id=pid)<>6 THEN RAISE EXCEPTION 'Rank or legacy chapters were reset/changed';END IF;
 IF (SELECT cash FROM mto_players WHERE id=pid)<>before_cash+100 THEN RAISE EXCEPTION 'Duplicate chapter cash';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'player'->'inventory')x WHERE x->>'id'='boots' AND NOT (x->>'equipped')::boolean) THEN RAISE EXCEPTION 'Boots reward not usable/unequipped';END IF;
 BEGIN PERFORM mto_action(pid,gen_random_uuid(),'chapter','{"id":"3"}');RAISE EXCEPTION 'Chapter skipped';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS errmsg=MESSAGE_TEXT;IF position('current guided chapter' IN errmsg)=0 THEN RAISE;END IF;END;
 PERFORM mto_action(pid,gen_random_uuid(),'deposit','{"amount":1}');PERFORM mto_action(pid,gen_random_uuid(),'withdraw','{"amount":1}');
 PERFORM mto_action(pid,gen_random_uuid(),'chapter','{"id":"2"}');
 PERFORM mto_action(pid,gen_random_uuid(),'equip','{"id":"boots"}');
 status:=mto_campaign_status(pid);IF NOT (status->'chapters'->2->>'ready')::boolean THEN RAISE EXCEPTION 'Equipment/two approaches not credited';END IF;
 PERFORM mto_action(pid,gen_random_uuid(),'chapter','{"id":"3"}');
 -- Rank and state criteria are both required, regardless of old chapter counter.
 UPDATE mto_players SET xp=0,attributes=jsonb_set(jsonb_set(attributes,'{fitness}','2'),'{focus}','2') WHERE id=pid;
 IF (mto_campaign_status(pid)->'chapters'->3->>'ready')::boolean THEN RAISE EXCEPTION 'Required rank bypassed';END IF;
 UPDATE mto_players SET xp=1500 WHERE id=pid;
 PERFORM mto_action(pid,gen_random_uuid(),'chapter','{"id":"4"}');
 IF jsonb_array_length((SELECT squad FROM mto_players WHERE id=pid))<>1 THEN RAISE EXCEPTION 'Campaign player missing';END IF;
 IF (mto_campaign_status(pid)->'chapters'->4->'goals'->0->>'progress')::int<>0 THEN RAISE EXCEPTION 'Gift counted as scout signing';END IF;
 -- Duplicate equipment becomes transparent cash, never overwrites equipped gear.
 INSERT INTO mto_players(identity,name,club,cash,inventory) VALUES('fixture:'||gen_random_uuid(),'Duplicate Gear','Duplicate FC',250,'[{"id":"boots","title":"Touchline Boots","slot":"feet","power":3,"equipped":true}]') RETURNING id INTO full_id;
 INSERT INTO mto_events(player_id,kind,message) SELECT full_id,'activity','Deliver Flyers did not come off' FROM generate_series(1,3);
 INSERT INTO mto_events(player_id,kind,message) SELECT full_id,'activity','Community Coaching completed. Earned £45' FROM generate_series(1,2);
 result:=mto_action(full_id,gen_random_uuid(),'chapter','{"id":"1"}');
 IF (result->>'cashDelta')::int<>220 OR jsonb_array_length(result->'player'->'inventory')<>1 OR NOT (result->'player'->'inventory'->0->>'equipped')::boolean THEN RAISE EXCEPTION 'Duplicate equipment handling lost gear';END IF;
 -- Full capacity includes escrowed listings. Reserve rather than losing a reward.
 INSERT INTO mto_players(identity,name,club,xp,cash,attributes,squad) SELECT 'fixture:'||gen_random_uuid(),'Full Squad','Full Squad FC',450,1000,'{"fitness":2,"focus":2,"leadership":1,"resilience":1}',jsonb_agg(jsonb_build_object('id',gen_random_uuid(),'name','Owned '||n,'position','MID','power',5,'value',100,'rarity','Local')) FROM generate_series(1,30)n RETURNING id INTO full_id;
 INSERT INTO mto_campaign_claims(player_id,chapter_id) SELECT full_id,n FROM generate_series(1,3)n;
 result:=mto_action(full_id,gen_random_uuid(),'chapter','{"id":"4"}');status:=mto_campaign_status(full_id);
 IF jsonb_array_length(result->'player'->'squad')<>30 OR jsonb_array_length(status->'pendingPlayers')<>1 THEN RAISE EXCEPTION 'Full-squad player reward lost or overflowed';END IF;
 reserved_id:=(status->'pendingPlayers'->0->'asset'->>'id')::uuid;
 BEGIN PERFORM mto_action(full_id,gen_random_uuid(),'claimCampaignPlayer','{"id":"4"}');RAISE EXCEPTION 'Ownership limit bypassed';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN GET STACKED DIAGNOSTICS errmsg=MESSAGE_TEXT;IF position('30-player ownership' IN errmsg)=0 THEN RAISE;END IF;END;
 SELECT (squad->0->>'id')::uuid INTO first_asset FROM mto_players WHERE id=full_id;
 PERFORM mto_action(full_id,gen_random_uuid(),'sellPlayer',jsonb_build_object('id',first_asset));
 k:=gen_random_uuid();result:=mto_action(full_id,k,'claimCampaignPlayer','{"id":"4"}');
 IF (result->'acquiredPlayer'->>'id')::uuid<>reserved_id OR jsonb_array_length(result->'player'->'squad')<>30 THEN RAISE EXCEPTION 'Reserved player rerolled or absent';END IF;
 IF mto_action(full_id,k,'claimCampaignPlayer','{"id":"4"}')<>result THEN RAISE EXCEPTION 'Reserved player replay changed';END IF;
 -- Historical trade and listing actions credit actual units/escrow learning.
 PERFORM mto_empire_action(pid,gen_random_uuid(),'buyGoods','{"id":"scarves","quantity":5}');
 UPDATE mto_players SET cooldowns=cooldowns-'trade',region='Sheffield' WHERE id=pid;
 PERFORM mto_empire_action(pid,gen_random_uuid(),'sellGoods','{"id":"scarves","quantity":3}');
 status:=mto_campaign_metrics(pid);
 IF (status->>'goods_bought')::int<>5 OR (status->>'goods_sold')::int<>3 OR (status->>'away_sales')::int<>3 THEN RAISE EXCEPTION 'Merchandise units not tracked';END IF;
 IF jsonb_array_length(mto_merchandise_routes(pid))<>3 THEN RAISE EXCEPTION 'Town comparisons absent';END IF;
 -- Endgame grants functional exclusive equipment and a real player without XP.
 INSERT INTO mto_players(identity,name,club,xp,cash) VALUES('fixture:'||gen_random_uuid(),'Endgame Test','Legend Test FC',750000,1000) RETURNING id INTO end_id;
 INSERT INTO mto_campaign_claims(player_id,chapter_id) SELECT end_id,n FROM generate_series(1,17)n;
 INSERT INTO mto_events(player_id,kind,message) SELECT end_id,'venture','Squad venture fell short' FROM generate_series(1,3);
 INSERT INTO mto_events(player_id,kind,message) SELECT end_id,'activity','World-Class Watchlist did not come off' FROM generate_series(1,2);
 INSERT INTO mto_events(player_id,kind,message) VALUES(end_id,'trade','Sold 10 Club Scarves in Sheffield');
 result:=mto_action(end_id,gen_random_uuid(),'chapter','{"id":"18"}');
 IF result->'player'->>'rankName'<>'Football Legend' OR result->'acquiredPlayer'->>'rarity'<>'Legendary' OR (result->>'cashDelta')::int<>5000 THEN RAISE EXCEPTION 'Endgame rewards incorrect';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(result->'player'->'inventory')x WHERE x->>'id'='campaign_crest' AND (x->>'power')::int=140) THEN RAISE EXCEPTION 'Exclusive useful gear absent';END IF;
 IF (SELECT xp FROM mto_players WHERE id=end_id)<>750000 OR (mto_campaign_status(end_id)->>'completed')::int<>18 THEN RAISE EXCEPTION 'Endgame altered hidden rank or incomplete';END IF;
 IF (SELECT count(*) FROM mto_ranks)<>13 OR EXISTS(SELECT 1 FROM mto_ranks WHERE name IN ('Scum','Pee Wee','Thug','Godfather')) THEN RAISE EXCEPTION 'Football rank mapping incomplete';END IF;
END $$;
