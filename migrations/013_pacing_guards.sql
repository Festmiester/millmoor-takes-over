-- Keep existing active partnerships safe when choosing the solo fallback.
DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_empire_action(uuid,uuid,text,jsonb)'::regprocedure) INTO definition;
 updated:=replace(definition,
 'IF action_kind=''soloVenture'' THEN',
 'IF action_kind=''soloVenture'' THEN
     IF EXISTS(SELECT 1 FROM mto_ventures WHERE status=''open'' AND expires_at>now() AND (partner=pid OR (host=pid AND partner IS NOT NULL))) THEN RAISE EXCEPTION ''Cancel or complete your partnered venture before using your squad''; END IF;
     UPDATE mto_ventures SET status=''cancelled'' WHERE host=pid AND partner IS NULL AND status=''open'';');
 IF updated=definition THEN RAISE EXCEPTION 'Expected solo branch not found'; END IF;
 EXECUTE updated;
 SELECT pg_get_functiondef('mto_action_v4(uuid,uuid,text,jsonb)'::regprocedure) INTO definition;
 updated:=replace(definition,'It recovers by 2 every minute','It recovers by 5 every 30 seconds');
 IF updated=definition THEN RAISE EXCEPTION 'Expected legacy recovery message not found'; END IF;
 EXECUTE updated;
END $$;
-- Keep a current member's own alliance visible even in a larger world.
DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_empire_status_v10(uuid)'::regprocedure) INTO definition;
 updated:=replace(definition,'ORDER BY a.created_at LIMIT 100','ORDER BY EXISTS(SELECT 1 FROM mto_members own WHERE own.player_id=pid AND own.alliance_id=a.id) DESC,a.created_at LIMIT 100');
 IF updated=definition THEN RAISE EXCEPTION 'Expected alliance ordering not found'; END IF;
 EXECUTE updated;
END $$;
INSERT INTO mto_migrations(version) VALUES(13);
