-- Attempts build proficiency with diminishing returns, including useful practice
-- after failure. Preserve earned legacy bonuses; never expose rank totals.
CREATE TABLE mto_practice(player_id uuid REFERENCES mto_players(id),activity_id text REFERENCES mto_activities(id),practice numeric NOT NULL DEFAULT 0 CHECK(practice>=0),PRIMARY KEY(player_id,activity_id));
CREATE FUNCTION mto_mastery(p mto_players) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_object_agg(a.id,least(30,greatest(0,coalesce((p.mastery->>a.id)::int,0))+floor(30*(1-exp(-coalesce(pr.practice,0)/80)))::int)),'{}'::jsonb)
 FROM mto_activities a LEFT JOIN mto_practice pr ON pr.player_id=p.id AND pr.activity_id=a.id
$$;
DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_action_v4(uuid,uuid,text,jsonb)'::regprocedure) INTO definition;
 updated:=replace(definition,'practiced:=coalesce((p.mastery->>a.id)::integer,0);','practiced:=coalesce((mto_mastery(p)->>a.id)::integer,0);');
 IF updated=definition THEN RAISE EXCEPTION 'Expected legacy proficiency read not found'; END IF;
 definition:=updated;
 updated:=replace(definition,'p.mastery:=jsonb_set(p.mastery,ARRAY[a.id],to_jsonb(greatest(-20,least(30,practiced+CASE WHEN success THEN greatest(1,4-practiced/12) ELSE -3 END))));',
 'INSERT INTO mto_practice(player_id,activity_id,practice) VALUES(pid,a.id,CASE WHEN success THEN 1 ELSE 0.5 END) ON CONFLICT(player_id,activity_id) DO UPDATE SET practice=mto_practice.practice+excluded.practice;');
 IF updated=definition THEN RAISE EXCEPTION 'Expected legacy proficiency write not found'; END IF;
 EXECUTE updated;
 SELECT pg_get_functiondef('mto_public(mto_players)'::regprocedure) INTO definition;
 updated:=replace(definition,'''energyMax'',mto_energy_max(p)', '''mastery'',mto_mastery(p),''energyMax'',mto_energy_max(p)');
 IF updated=definition THEN RAISE EXCEPTION 'Expected public stamina expression not found'; END IF;
 EXECUTE updated;
END $$;
-- At fresh proficiency, every office approach has an expected cash return of
-- at least £5 per stamina (or £15 for cheaper moves). Costs/failure risk remain.
UPDATE mto_activities SET reward=greatest(reward,ceil((cost+greatest(15,energy*5))/least(least(95,chance+10)*0.008,chance*0.01,greatest(10,chance-10)*0.013))::int) WHERE category='office' AND cost>0;
INSERT INTO mto_migrations(version) VALUES(12);
