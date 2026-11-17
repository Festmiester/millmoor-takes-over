DO $$
DECLARE pid uuid; partner_id uuid; k uuid:=gen_random_uuid(); r jsonb; before_state jsonb; after_state jsonb; first numeric; bonuses integer[]:='{}'; v integer; stat text; expected integer; errmsg text;
BEGIN
 INSERT INTO mto_players(identity,name,club,xp,cash) VALUES('fixture:'||gen_random_uuid(),'Pacing Final','Pacing Final FC',1500,100000) RETURNING id INTO pid;
 INSERT INTO mto_players(identity,name,club,xp,cash) VALUES('fixture:'||gen_random_uuid(),'Pacing Partner','Pacing Partner FC',1500,100000) RETURNING id INTO partner_id;
 r:=mto_action(pid,k,'activity','{"id":"flyers"}');
 SELECT practice INTO first FROM mto_practice WHERE player_id=pid AND activity_id='flyers';
 IF first<>(CASE WHEN (r->>'success')::boolean THEN 1 ELSE 0.5 END) THEN RAISE EXCEPTION 'Practice amount incorrect'; END IF;
 PERFORM mto_action(pid,k,'activity','{"id":"flyers"}');
 IF (SELECT practice FROM mto_practice WHERE player_id=pid AND activity_id='flyers')<>first THEN RAISE EXCEPTION 'Replay duplicated practice'; END IF;
 FOREACH v IN ARRAY ARRAY[0,80,160,10000] LOOP
  UPDATE mto_practice SET practice=v WHERE player_id=pid AND activity_id='flyers';
  SELECT mto_public(p) INTO r FROM mto_players p WHERE p.id=pid;
  bonuses:=array_append(bonuses,(r->'mastery'->>'flyers')::int);
 END LOOP;
 IF bonuses[2]-bonuses[1]<=bonuses[3]-bonuses[2] OR bonuses[4]>30 THEN RAISE EXCEPTION 'Diminishing cap incorrect'; END IF;
 SELECT mto_public(p) INTO before_state FROM mto_players p WHERE p.id=pid;
 FOREACH stat IN ARRAY ARRAY['leadership','focus','resilience','fitness'] LOOP
  UPDATE mto_players SET cooldowns=cooldowns-'training' WHERE id=pid;
  r:=mto_action(pid,gen_random_uuid(),'train',jsonb_build_object('stat',stat));after_state:=r->'player';
  expected:=CASE stat WHEN 'resilience' THEN 2 WHEN 'fitness' THEN 0 ELSE 1 END;
  IF (after_state->>'power')::int-(before_state->>'power')::int<>expected THEN RAISE EXCEPTION 'Training power incorrect for %',stat; END IF;
  IF stat='fitness' AND (after_state->>'energyMax')::int-(before_state->>'energyMax')::int<>5 THEN RAISE EXCEPTION 'Fitness capacity incorrect'; END IF;
  before_state:=after_state;
 END LOOP;
 INSERT INTO mto_ventures(host,partner,region) VALUES(pid,partner_id,'Rotherham');
 BEGIN
  PERFORM mto_empire_action(pid,gen_random_uuid(),'soloVenture','{"players":[]}');
  RAISE EXCEPTION 'Guard did not reject partnered venture';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN
  GET STACKED DIAGNOSTICS errmsg=MESSAGE_TEXT;
  IF position('Cancel or complete your partnered' IN errmsg)=0 THEN RAISE; END IF;
 END;
END $$;
