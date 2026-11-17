-- Stamina capacity/recovery, solo squad operations and a regional community board.
ALTER TABLE mto_players DROP CONSTRAINT mto_players_energy_check;
ALTER TABLE mto_players ADD CONSTRAINT mto_players_energy_check CHECK(energy BETWEEN 0 AND 300);
ALTER TABLE mto_players ALTER COLUMN energy SET DEFAULT 200;
CREATE FUNCTION mto_energy_max(p mto_players) RETURNS integer LANGUAGE sql IMMUTABLE AS $$
 SELECT 200+least(100,greatest(0,(coalesce((p.attributes->>'fitness')::int,1)-1)*5))
$$;
CREATE OR REPLACE FUNCTION mto_refresh(pid uuid) RETURNS mto_players LANGUAGE plpgsql AS $$
DECLARE p mto_players; ticks integer;
BEGIN
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
 ticks:=greatest(0,floor(extract(epoch FROM now()-p.energy_at)/30));
 IF ticks>0 THEN
   p.energy:=least(mto_energy_max(p),p.energy+ticks*5);
   p.energy_at:=CASE WHEN p.energy=mto_energy_max(p) THEN now() ELSE p.energy_at+ticks*interval '30 seconds' END;
 END IF;
 UPDATE mto_players SET energy=p.energy,energy_at=p.energy_at,last_seen=now() WHERE id=pid RETURNING * INTO p;
 RETURN p;
END $$;
ALTER FUNCTION mto_public(mto_players) RENAME TO mto_public_v10;
CREATE FUNCTION mto_public(p mto_players) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT mto_public_v10(p)||jsonb_build_object('energyMax',mto_energy_max(p),'energyRegen',5,'energyInterval',30)
$$;
ALTER TABLE mto_ventures ALTER COLUMN alliance_id DROP NOT NULL;
ALTER TABLE mto_ventures ADD COLUMN region text NOT NULL DEFAULT 'Rotherham';
UPDATE mto_ventures v SET region=p.region FROM mto_players p WHERE p.id=v.host;
-- The entry fee changes; old readiness is not consent to the new terms.
UPDATE mto_ventures SET host_ready=false,partner_ready=false WHERE status='open';
CREATE TABLE mto_asset_duties(asset_id uuid PRIMARY KEY,player_id uuid NOT NULL REFERENCES mto_players(id),available_at timestamptz NOT NULL);
CREATE TABLE mto_board_posts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),parent_id uuid REFERENCES mto_board_posts(id),author uuid NOT NULL REFERENCES mto_players(id),region text NOT NULL,category text NOT NULL CHECK(category IN ('chat','questions','ventures')),title text NOT NULL CHECK(char_length(title) BETWEEN 2 AND 80),body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),removed boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX mto_board_region ON mto_board_posts(region,created_at DESC);
ALTER FUNCTION mto_empire_status(uuid) RENAME TO mto_empire_status_v10;
CREATE FUNCTION mto_empire_status(pid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT mto_empire_status_v10(pid)||jsonb_build_object(
 'ventureRules',jsonb_build_object('hours',8,'humanCost',500,'humanGross',8000,'soloCost',750,'soloGross',4500,'energy',20),
 'crewDuties',coalesce((SELECT jsonb_agg(jsonb_build_object('id',d.asset_id,'availableAt',d.available_at)) FROM mto_asset_duties d WHERE d.available_at>now() AND d.asset_id IN (SELECT (a->>'id')::uuid FROM mto_players p,jsonb_array_elements(p.squad)a WHERE p.id=pid)),'[]'::jsonb),
 'board',coalesce((SELECT jsonb_agg(x) FROM (SELECT b.id,b.parent_id AS "parentId",b.author,b.region,b.category,b.title,b.body,b.created_at AS "createdAt",p.name,p.club FROM mto_board_posts b JOIN mto_players p ON p.id=b.author WHERE NOT b.removed AND b.region=(SELECT region FROM mto_players WHERE id=pid) AND (b.parent_id IS NULL OR EXISTS(SELECT 1 FROM mto_board_posts t WHERE t.id=b.parent_id AND NOT t.removed)) ORDER BY b.created_at DESC LIMIT 100)x),'[]'::jsonb),
 'ventures',coalesce((SELECT jsonb_agg(x) FROM (SELECT v.id,v.host,v.partner,v.host_ready AS "hostReady",v.partner_ready AS "partnerReady",v.status,v.success,v.region,v.expires_at AS "expiresAt",h.club AS "hostClub",p.club AS "partnerClub" FROM mto_ventures v JOIN mto_players h ON h.id=v.host LEFT JOIN mto_players p ON p.id=v.partner WHERE ((v.alliance_id IS NULL AND v.region=(SELECT region FROM mto_players WHERE id=pid)) OR v.alliance_id=(SELECT alliance_id FROM mto_members WHERE player_id=pid) OR v.host=pid OR v.partner=pid) AND (v.status<>'open' OR v.expires_at>now()) ORDER BY v.created_at DESC LIMIT 20)x),'[]'::jsonb))
$$;
ALTER FUNCTION mto_empire_action(uuid,uuid,text,jsonb) RENAME TO mto_empire_action_v10;
CREATE FUNCTION mto_empire_action(pid uuid,request_key uuid,action_kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; other mto_players; v mto_ventures; old_result jsonb; result jsonb;
 msg text; won boolean:=true; gross integer:=0; fee integer:=0; spent integer:=0; chance integer;
 ids uuid[]; a jsonb; power integer:=0; parent mto_board_posts; category text; title text; content text;
BEGIN
 IF action_kind NOT IN ('soloVenture','createVenture','joinVenture','readyVenture','cancelVenture','resolveVenture','boardPost','removeBoardPost') THEN
 RETURN mto_empire_action_v10(pid,request_key,action_kind,input); END IF;
 PERFORM pg_advisory_xact_lock(731791017);
 IF action_kind IN ('joinVenture','readyVenture','cancelVenture','resolveVenture') THEN SELECT * INTO v FROM mto_ventures WHERE id=(input->>'id')::uuid FOR UPDATE; END IF;
 PERFORM id FROM mto_players WHERE id IN(pid,CASE WHEN action_kind='resolveVenture' THEN v.partner ELSE NULL END) ORDER BY id FOR UPDATE;
 SELECT r.result INTO old_result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;
 IF FOUND THEN RETURN old_result; END IF;
 p:=mto_refresh(pid);
 IF action_kind='boardPost' THEN
   content:=trim(input->>'body');title:=trim(input->>'title');category:=input->>'category';
   IF content IS NULL OR char_length(content) NOT BETWEEN 1 AND 1000 OR content~'[<>[:cntrl:]]' THEN RAISE EXCEPTION 'Use 1 to 1000 plain text characters'; END IF;
   IF nullif(input->>'parent','') IS NOT NULL THEN
     SELECT * INTO parent FROM mto_board_posts WHERE id=(input->>'parent')::uuid AND parent_id IS NULL AND NOT removed;
     IF NOT FOUND OR parent.region<>p.region THEN RAISE EXCEPTION 'Topic is not available in your location'; END IF;
     title:=parent.title;category:=parent.category;
   END IF;
   IF title IS NULL OR char_length(title) NOT BETWEEN 2 AND 80 OR title~'[<>[:cntrl:]]' OR category NOT IN ('chat','questions','ventures') OR category IS NULL THEN RAISE EXCEPTION 'Choose a category and a title of 2 to 80 characters'; END IF;
   IF (SELECT count(*) FROM mto_board_posts WHERE author=pid AND created_at>now()-interval '1 day')>=60 THEN RAISE EXCEPTION 'Daily board limit reached'; END IF;
   IF EXISTS(SELECT 1 FROM mto_board_posts WHERE author=pid AND created_at>now()-interval '8 seconds') THEN RAISE EXCEPTION 'Wait eight seconds between board posts'; END IF;
   INSERT INTO mto_board_posts(parent_id,author,region,category,title,body) VALUES(parent.id,pid,p.region,category,title,content);
   msg:='Posted to the '||p.region||' community board';
 ELSIF action_kind='removeBoardPost' THEN
   UPDATE mto_board_posts SET removed=true WHERE id=(input->>'id')::uuid AND author=pid AND NOT removed;
   IF NOT FOUND THEN RAISE EXCEPTION 'Only the author can remove this post'; END IF;msg:='Your post was removed';
 ELSE
   IF mto_rank(p.xp)<2 THEN RAISE EXCEPTION 'Ventures unlock at Thug'; END IF;
   IF action_kind='soloVenture' THEN
     IF (p.cooldowns->>'venture')::timestamptz>now() THEN RAISE EXCEPTION 'Your venture is cooling down'; END IF;
     IF p.cash<750 OR p.energy<20 THEN RAISE EXCEPTION 'Solo ventures require £750 and 20 stamina'; END IF;
     IF jsonb_typeof(input->'players') IS DISTINCT FROM 'array' OR jsonb_array_length(input->'players')<>3 THEN RAISE EXCEPTION 'Choose three different owned players'; END IF;
     SELECT array_agg(x::uuid) INTO ids FROM jsonb_array_elements_text(input->'players')x;
     IF (SELECT count(DISTINCT x) FROM unnest(ids)x)<>3 THEN RAISE EXCEPTION 'Choose three different owned players'; END IF;
     FOREACH v.host IN ARRAY ids LOOP
       SELECT x INTO a FROM jsonb_array_elements(p.squad)x WHERE (x->>'id')::uuid=v.host;
       IF a IS NULL THEN RAISE EXCEPTION 'Only your available, unlisted players can take part'; END IF;
       IF EXISTS(SELECT 1 FROM mto_asset_duties WHERE asset_id=v.host AND available_at>now()) THEN RAISE EXCEPTION 'A selected player is still recovering from a venture'; END IF;
       power:=power+(a->>'power')::int;
     END LOOP;
     chance:=least(85,55+power/6+least(10,p.facility));won:=random()*100<chance;
     fee:=750;spent:=20;gross:=CASE WHEN won THEN 4500 ELSE 0 END;
     INSERT INTO mto_asset_duties(asset_id,player_id,available_at) SELECT x,pid,now()+interval '8 hours' FROM unnest(ids)x ON CONFLICT(asset_id) DO UPDATE SET player_id=excluded.player_id,available_at=excluded.available_at;
     UPDATE mto_players SET xp=xp+CASE WHEN won THEN 750 ELSE 50 END WHERE id=pid;
     msg:=CASE WHEN won THEN 'Squad venture succeeded. Gross £4500, entry £750. Your three players return in eight hours' ELSE 'Squad venture fell short. Entry £750. Your players return in eight hours' END;
   ELSIF action_kind='createVenture' THEN
     IF EXISTS(SELECT 1 FROM mto_ventures WHERE status='open' AND expires_at>now() AND (host=pid OR partner=pid)) THEN RAISE EXCEPTION 'Finish or cancel your current venture first'; END IF;
     INSERT INTO mto_ventures(host,region) VALUES(pid,p.region);msg:='Tournament opened in '||p.region||'. Find a partner on the Venture Classifieds board';
   ELSE
     IF v.id IS NULL OR v.status<>'open' OR v.expires_at<=now() THEN RAISE EXCEPTION 'Venture is no longer open'; END IF;
     IF v.alliance_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM mto_members WHERE player_id=pid AND alliance_id=v.alliance_id) THEN RAISE EXCEPTION 'This venture is private to its alliance'; END IF;
     IF action_kind='joinVenture' THEN
       IF v.region<>p.region THEN RAISE EXCEPTION 'Travel to the host location first'; END IF;
       IF v.host=pid OR v.partner IS NOT NULL THEN RAISE EXCEPTION 'Venture already has its participants'; END IF;
       IF EXISTS(SELECT 1 FROM mto_ventures WHERE status='open' AND expires_at>now() AND (host=pid OR partner=pid)) THEN RAISE EXCEPTION 'Finish your current venture first'; END IF;
       UPDATE mto_ventures SET partner=pid WHERE id=v.id;msg:='Joined the tournament. Both managers must mark ready';
     ELSE
       IF pid<>v.host AND pid IS DISTINCT FROM v.partner THEN RAISE EXCEPTION 'You are not a participant'; END IF;
       IF action_kind='cancelVenture' THEN UPDATE mto_ventures SET status='cancelled' WHERE id=v.id;msg:='Venture cancelled without charging entry fees';
       ELSIF action_kind='readyVenture' THEN
         IF (pid=v.host AND v.host_ready) OR (pid=v.partner AND v.partner_ready) THEN
           UPDATE mto_ventures SET host_ready=CASE WHEN host=pid THEN false ELSE host_ready END,partner_ready=CASE WHEN partner=pid THEN false ELSE partner_ready END WHERE id=v.id;
         ELSE
           IF p.region<>v.region OR p.cash<500 OR p.energy<20 THEN RAISE EXCEPTION 'Readiness requires the host location, £500 and 20 stamina'; END IF;
           IF (p.cooldowns->>'venture')::timestamptz>now() THEN RAISE EXCEPTION 'Ventures have an eight-hour cooldown'; END IF;
           UPDATE mto_ventures SET host_ready=CASE WHEN host=pid THEN true ELSE host_ready END,partner_ready=CASE WHEN partner=pid THEN true ELSE partner_ready END WHERE id=v.id;
         END IF;msg:='Readiness updated for the £500 entry and 20 stamina cost';
       ELSE
         IF pid<>v.host OR v.partner IS NULL OR NOT v.host_ready OR NOT v.partner_ready THEN RAISE EXCEPTION 'Only the host can start after both managers are ready'; END IF;
         other:=mto_refresh(v.partner);
         IF p.region<>v.region OR other.region<>v.region OR p.cash<500 OR other.cash<500 OR p.energy<20 OR other.energy<20 THEN RAISE EXCEPTION 'Both clubs need the host location, £500 and 20 stamina'; END IF;
         IF (p.cooldowns->>'venture')::timestamptz>now() OR (other.cooldowns->>'venture')::timestamptz>now() THEN RAISE EXCEPTION 'A participant is cooling down'; END IF;
         won:=random()*100<least(90,65+(mto_power(p)+mto_power(other))/20);
         fee:=500;spent:=20;gross:=CASE WHEN won THEN 8000 ELSE 0 END;
         UPDATE mto_players SET cash=cash+gross-fee,energy=energy-spent,xp=xp+CASE WHEN won THEN 1500 ELSE 100 END,cooldowns=jsonb_set(cooldowns,'{venture}',to_jsonb(now()+interval '8 hours')) WHERE id=v.partner;
         UPDATE mto_players SET xp=xp+CASE WHEN won THEN 1500 ELSE 100 END WHERE id=pid;
         UPDATE mto_ventures SET status='complete',success=won WHERE id=v.id;
         msg:=CASE WHEN won THEN 'Tournament succeeded. Each club earned £8000 before the £500 entry cost' ELSE 'Tournament fell short. Each club spent £500 and 20 stamina' END;
         INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(v.partner,'venture',msg,gross-fee);
       END IF;
     END IF;
   END IF;
 END IF;
 UPDATE mto_players SET cash=cash+gross-fee,energy=energy-spent,cooldowns=CASE WHEN spent>0 THEN jsonb_set(cooldowns,'{venture}',to_jsonb(now()+interval '8 hours')) ELSE cooldowns END WHERE id=pid RETURNING * INTO p;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(pid,CASE WHEN spent>0 THEN 'venture' ELSE 'community' END,msg,gross-fee);
 result:=jsonb_build_object('success',won,'message',msg,'cashDelta',gross-fee,'player',mto_public(p),'serverTime',now());
 INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,result);RETURN result;
END $$;
INSERT INTO mto_migrations(version) VALUES(11);
