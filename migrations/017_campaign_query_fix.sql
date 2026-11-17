DO $$
DECLARE definition text; updated text;
BEGIN
 SELECT pg_get_functiondef('mto_campaign_status(uuid)'::regprocedure) INTO definition;
 updated:=replace(definition,'SELECT min(id) INTO next_id FROM mto_campaign_chapters c WHERE NOT EXISTS(SELECT 1 FROM mto_campaign_claims cl WHERE cl.player_id=pid AND cl.chapter_id=c.id)',
 'SELECT min(catalog.id) INTO next_id FROM mto_campaign_chapters catalog WHERE NOT EXISTS(SELECT 1 FROM mto_campaign_claims cl WHERE cl.player_id=pid AND cl.chapter_id=catalog.id)');
 IF updated=definition THEN RAISE EXCEPTION 'Expected campaign cursor query not found';END IF;EXECUTE updated;
END $$;
INSERT INTO mto_migrations(version) VALUES(17);
