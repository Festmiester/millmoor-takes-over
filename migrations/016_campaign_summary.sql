ALTER FUNCTION mto_public(mto_players) RENAME TO mto_public_v14;
CREATE FUNCTION mto_public(p mto_players) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT mto_public_v14(p)||jsonb_build_object('campaignCompleted',(SELECT count(*) FROM mto_campaign_claims WHERE player_id=p.id))
$$;
-- An actual scout signing is distinct from owning a campaign reward player.
DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_campaign_metrics(uuid)'::regprocedure) INTO definition;
 updated:=replace(definition,'''scouting'',coalesce', '''scout_signed'',(SELECT count(*) FROM events e JOIN mto_activities a ON a.category=''scouting'' AND e.kind=''activity'' AND e.message LIKE a.title||''%'' WHERE lower(e.message) LIKE ''%signed %''),''scouting'',coalesce');
 IF updated=definition THEN RAISE EXCEPTION 'Expected scout metric not found'; END IF;EXECUTE updated;
END $$;
UPDATE mto_campaign_chapters SET goals='[{"metric":"scout_signed","target":1,"label":"Sign a player through scouting","route":"scouting"},{"metric":"recruitment","target":1,"label":"Attempt a recruitment deal","route":"recruitment"}]' WHERE id=5;
INSERT INTO mto_migrations(version) VALUES(16);
