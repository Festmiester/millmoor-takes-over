-- Every trained football attribute contributes to actual club capability.
CREATE OR REPLACE FUNCTION mto_power(p mto_players) RETURNS integer LANGUAGE sql STABLE AS $$
 SELECT coalesce((SELECT sum((x->>'power')::int) FROM jsonb_array_elements(p.inventory)x WHERE (x->>'equipped')::boolean),0)::int
 +p.facility*5+coalesce((p.attributes->>'leadership')::int,1)
 +greatest(0,coalesce((p.attributes->>'focus')::int,1)-1)
 +2*greatest(0,coalesce((p.attributes->>'resilience')::int,1)-1)
 +greatest(0,coalesce((p.attributes->>'fitness')::int,1)-1)/4
$$;
DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_action_v4(uuid,uuid,text,jsonb)'::regprocedure) INTO definition;
 updated:=replace(definition,'a.chance+practiced+least(6,p.facility)+CASE',
 'a.chance+practiced+least(6,p.facility)+least(5,greatest(0,((p.attributes->>''focus'')::int-1)/4))+CASE');
 IF updated=definition THEN RAISE EXCEPTION 'Expected chance expression not found'; END IF;
 EXECUTE updated;
END $$;
-- Allow for integer payout rounding in the fresh-proficiency cash target.
UPDATE mto_activities SET reward=reward+2 WHERE category='office' AND cost>0;
INSERT INTO mto_migrations(version) VALUES(14);
