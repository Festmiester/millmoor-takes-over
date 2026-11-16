-- Qualify event columns that share names with game action parameters.
DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_action(uuid,uuid,text,jsonb)'::regprocedure) INTO definition;
 updated:=replace(definition,
 'UPDATE mto_events SET message=result->>''message'' WHERE id=(SELECT max(id) FROM mto_events WHERE player_id=pid AND kind=''activity'')',
 'UPDATE mto_events e SET message=scout_engine.result->>''message'' WHERE e.id=(SELECT max(ev.id) FROM mto_events ev WHERE ev.player_id=pid AND ev.kind=''activity'')');
 IF updated=definition THEN RAISE EXCEPTION 'Expected scouting event statement was not found'; END IF;
 EXECUTE updated;
END $$;
INSERT INTO mto_migrations(version) VALUES(8);
