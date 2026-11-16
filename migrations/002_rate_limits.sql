BEGIN;
CREATE TABLE mto_rate_limits(key text PRIMARY KEY,window_start timestamptz NOT NULL,count integer NOT NULL);
CREATE FUNCTION mto_throttle(k text,max_requests integer) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
 INSERT INTO mto_rate_limits(key,window_start,count) VALUES(k,date_trunc('minute',now()),1)
 ON CONFLICT(key) DO UPDATE SET window_start=date_trunc('minute',now()),count=CASE WHEN mto_rate_limits.window_start=date_trunc('minute',now()) THEN mto_rate_limits.count+1 ELSE 1 END RETURNING count INTO n;
 RETURN n<=max_requests;
END $$;
INSERT INTO mto_migrations(version) VALUES(2);
COMMIT;
