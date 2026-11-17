-- Additive original football economy and social play. No club-app dependencies.
CREATE TABLE mto_goods(id text PRIMARY KEY,title text NOT NULL,base integer NOT NULL CHECK(base>4));
INSERT INTO mto_goods VALUES('scarves','Club Scarves',18),('shirts','Replica Shirts',42),('programmes','Match Programmes',9);
CREATE TABLE mto_stock(player_id uuid REFERENCES mto_players(id),good_id text REFERENCES mto_goods(id),quantity integer NOT NULL CHECK(quantity>=0 AND quantity<=100),PRIMARY KEY(player_id,good_id));
CREATE FUNCTION mto_goods_price(good text,city text) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT base+mod(abs(hashtext(city||good||(now() AT TIME ZONE 'UTC')::date)::bigint),9)::int-4 FROM mto_goods WHERE id=good $$;
CREATE TABLE mto_alliances(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 32),owner uuid NOT NULL REFERENCES mto_players(id),active boolean NOT NULL DEFAULT true,created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX mto_alliance_name ON mto_alliances(lower(name)) WHERE active;
CREATE TABLE mto_members(player_id uuid PRIMARY KEY REFERENCES mto_players(id),alliance_id uuid NOT NULL REFERENCES mto_alliances(id),joined_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mto_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),sender uuid NOT NULL REFERENCES mto_players(id),recipient uuid REFERENCES mto_players(id),alliance_id uuid REFERENCES mto_alliances(id),body text NOT NULL CHECK(char_length(body) BETWEEN 1 AND 1000),read_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),CHECK((recipient IS NULL)<>(alliance_id IS NULL)));
CREATE INDEX mto_messages_inbox ON mto_messages(recipient,created_at DESC);
CREATE INDEX mto_messages_alliance ON mto_messages(alliance_id,created_at DESC);
CREATE TABLE mto_ventures(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),alliance_id uuid NOT NULL REFERENCES mto_alliances(id),host uuid NOT NULL REFERENCES mto_players(id),partner uuid REFERENCES mto_players(id),host_ready boolean NOT NULL DEFAULT false,partner_ready boolean NOT NULL DEFAULT false,status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','complete','cancelled')),success boolean,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT now()+interval '1 day');
CREATE FUNCTION mto_empire_status(pid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('serverTime',now(),'business',mto_business_status(pid),
 'trade',jsonb_build_object('capacity',100,'goods',(SELECT jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'buy',mto_goods_price(g.id,p.region),'sell',mto_goods_price(g.id,p.region)-3,'owned',coalesce(s.quantity,0)) ORDER BY g.base) FROM mto_goods g CROSS JOIN mto_players p LEFT JOIN mto_stock s ON s.player_id=pid AND s.good_id=g.id WHERE p.id=pid)),
 'alliances',coalesce((SELECT jsonb_agg(x) FROM (SELECT a.id,a.name,a.owner,(SELECT count(*) FROM mto_members m WHERE m.alliance_id=a.id) AS members,EXISTS(SELECT 1 FROM mto_members m WHERE m.alliance_id=a.id AND m.player_id=pid) AS joined FROM mto_alliances a WHERE a.active ORDER BY a.created_at LIMIT 100)x),'[]'::jsonb),
 'members',coalesce((SELECT jsonb_agg(x) FROM (SELECT p.id,p.name,p.club FROM mto_members m JOIN mto_players p ON p.id=m.player_id WHERE m.alliance_id=(SELECT alliance_id FROM mto_members WHERE player_id=pid) ORDER BY m.joined_at)x),'[]'::jsonb),
 'messages',coalesce((SELECT jsonb_agg(x) FROM (SELECT m.id,m.sender,m.recipient,m.alliance_id AS "allianceId",m.body,m.read_at AS "readAt",m.created_at AS "createdAt",s.name AS "senderName",r.name AS "recipientName" FROM mto_messages m JOIN mto_players s ON s.id=m.sender LEFT JOIN mto_players r ON r.id=m.recipient WHERE (m.alliance_id IS NULL AND (m.sender=pid OR m.recipient=pid)) OR m.alliance_id=(SELECT alliance_id FROM mto_members WHERE player_id=pid) ORDER BY m.created_at DESC LIMIT 50)x),'[]'::jsonb),
 'ventures',coalesce((SELECT jsonb_agg(x) FROM (SELECT v.id,v.host,v.partner,v.host_ready AS "hostReady",v.partner_ready AS "partnerReady",v.status,v.success,v.expires_at AS "expiresAt",h.club AS "hostClub",p.club AS "partnerClub" FROM mto_ventures v JOIN mto_players h ON h.id=v.host LEFT JOIN mto_players p ON p.id=v.partner WHERE v.alliance_id=(SELECT alliance_id FROM mto_members WHERE player_id=pid) AND (v.status<>'open' OR v.expires_at>now()) ORDER BY v.created_at DESC LIMIT 20)x),'[]'::jsonb))
$$;
CREATE FUNCTION mto_empire_action(pid uuid,request_key uuid,action_kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; other mto_players; v mto_ventures; aid uuid; target uuid;
 previous jsonb; result jsonb; msg text; amount integer:=0; qty integer; price integer;
 stock integer; fee integer:=0; won boolean:=true; content text; new_id uuid;
BEGIN
 IF action_kind IN ('buyBusiness','collectBusiness','upgradeBusiness') THEN
   RETURN mto_business_action(pid,request_key,action_kind,input->>'id');
 END IF;
 -- Serialize the small shared-world coordination layer, then lock players in UUID order.
 -- Existing banking/market actions continue to use their own row-level locking.
 PERFORM pg_advisory_xact_lock(731791017);
 IF action_kind='resolveVenture' THEN SELECT * INTO v FROM mto_ventures WHERE id=(input->>'id')::uuid FOR UPDATE; END IF;
 PERFORM id FROM mto_players WHERE id IN (pid,v.host,v.partner) ORDER BY id FOR UPDATE;
 SELECT r.result INTO previous FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;
 IF FOUND THEN RETURN previous; END IF;
 p:=mto_refresh(pid);
 SELECT alliance_id INTO aid FROM mto_members WHERE player_id=pid;
 IF action_kind IN ('buyGoods','sellGoods') THEN
   IF mto_rank(p.xp)<1 THEN RAISE EXCEPTION 'Trading unlocks at Pee Wee'; END IF;
   IF (p.cooldowns->>'trade')::timestamptz>now() THEN RAISE EXCEPTION 'Trading is cooling down'; END IF;
   qty:=(input->>'quantity')::integer;
   IF qty IS NULL OR qty<1 OR qty>20 THEN RAISE EXCEPTION 'Trade 1 to 20 units at a time'; END IF;
   price:=mto_goods_price(input->>'id',p.region);
   IF price IS NULL THEN RAISE EXCEPTION 'Unknown merchandise'; END IF;
   SELECT coalesce(sum(quantity),0) INTO stock FROM mto_stock WHERE player_id=pid;
   IF action_kind='buyGoods' THEN
     fee:=qty*price;
     IF p.cash<fee THEN RAISE EXCEPTION 'Not enough cash'; END IF;
     IF stock+qty>100 THEN RAISE EXCEPTION 'Merchandise storage is full'; END IF;
     INSERT INTO mto_stock(player_id,good_id,quantity) VALUES(pid,input->>'id',qty) ON CONFLICT(player_id,good_id) DO UPDATE SET quantity=mto_stock.quantity+excluded.quantity;
   ELSE
     SELECT quantity INTO stock FROM mto_stock WHERE player_id=pid AND good_id=input->>'id';
     IF coalesce(stock,0)<qty THEN RAISE EXCEPTION 'Not enough merchandise'; END IF;
     amount:=qty*(price-3);
     UPDATE mto_stock SET quantity=quantity-qty WHERE player_id=pid AND good_id=input->>'id';
   END IF;
   UPDATE mto_players SET cooldowns=jsonb_set(cooldowns,'{trade}',to_jsonb(now()+interval '15 seconds')) WHERE id=pid;
   msg:=CASE action_kind WHEN 'buyGoods' THEN 'Bought ' ELSE 'Sold ' END||qty||' '||(SELECT title FROM mto_goods WHERE id=input->>'id')||' in '||p.region;
 ELSIF action_kind='createAlliance' THEN
   IF mto_rank(p.xp)<1 THEN RAISE EXCEPTION 'Alliances unlock at Pee Wee'; END IF;
   IF aid IS NOT NULL THEN RAISE EXCEPTION 'Leave your current alliance first'; END IF;
   content:=trim(input->>'name');
   IF content IS NULL OR char_length(content) NOT BETWEEN 2 AND 32 OR content~'[<>[:cntrl:]]' THEN RAISE EXCEPTION 'Enter a plain alliance name, 2 to 32 characters'; END IF;
   IF EXISTS(SELECT 1 FROM mto_alliances WHERE active AND lower(name)=lower(content)) THEN RAISE EXCEPTION 'That alliance name is taken'; END IF;
   fee:=250;IF p.cash<fee THEN RAISE EXCEPTION 'Opening an alliance costs £250'; END IF;
   INSERT INTO mto_alliances(name,owner) VALUES(content,pid) RETURNING id INTO new_id;
   INSERT INTO mto_members VALUES(pid,new_id,now());msg:='Founded alliance '||content;
 ELSIF action_kind='joinAlliance' THEN
   IF mto_rank(p.xp)<1 THEN RAISE EXCEPTION 'Alliances unlock at Pee Wee'; END IF;
   IF aid IS NOT NULL THEN RAISE EXCEPTION 'You already belong to an alliance'; END IF;
   aid:=(input->>'id')::uuid;
   IF NOT EXISTS(SELECT 1 FROM mto_alliances WHERE id=aid AND active) THEN RAISE EXCEPTION 'Alliance not available'; END IF;
   IF (SELECT count(*) FROM mto_members WHERE alliance_id=aid)>=12 THEN RAISE EXCEPTION 'Alliance is full'; END IF;
   INSERT INTO mto_members VALUES(pid,aid,now());msg:='Joined alliance';
 ELSIF action_kind='leaveAlliance' THEN
   IF aid IS NULL THEN RAISE EXCEPTION 'You are not in an alliance'; END IF;
   DELETE FROM mto_members WHERE player_id=pid;
   UPDATE mto_ventures SET status='cancelled' WHERE status='open' AND (host=pid OR partner=pid);
   SELECT player_id INTO target FROM mto_members WHERE alliance_id=aid ORDER BY joined_at,player_id LIMIT 1;
   IF target IS NULL THEN UPDATE mto_alliances SET active=false WHERE id=aid;
   ELSE UPDATE mto_alliances SET owner=target WHERE id=aid AND owner=pid; END IF;
   msg:='Left alliance. Any waiting ventures involving your club were cancelled';
 ELSIF action_kind IN ('sendMessage','allianceMessage') THEN
   content:=trim(input->>'body');
   IF content IS NULL OR char_length(content) NOT BETWEEN 1 AND 1000 OR content~'[<>[:cntrl:]]' THEN RAISE EXCEPTION 'Messages must contain 1 to 1000 plain text characters'; END IF;
   IF (SELECT count(*) FROM mto_messages WHERE sender=pid AND created_at>now()-interval '1 day')>=100 THEN RAISE EXCEPTION 'Daily message limit reached'; END IF;
   IF action_kind='sendMessage' THEN
     target:=(input->>'target')::uuid;
     IF target=pid OR NOT EXISTS(SELECT 1 FROM mto_players WHERE id=target) THEN RAISE EXCEPTION 'Choose another manager'; END IF;
     INSERT INTO mto_messages(sender,recipient,body) VALUES(pid,target,content);
   ELSE
     IF aid IS NULL THEN RAISE EXCEPTION 'Join an alliance first'; END IF;
     INSERT INTO mto_messages(sender,alliance_id,body) VALUES(pid,aid,content);
   END IF;
   msg:='Message sent';
 ELSIF action_kind='readMessage' THEN
   UPDATE mto_messages SET read_at=coalesce(read_at,now()) WHERE id=(input->>'id')::uuid AND recipient=pid;
   IF NOT FOUND THEN RAISE EXCEPTION 'Message is not in your inbox'; END IF;msg:='Message marked as read';
 ELSIF action_kind IN ('createVenture','joinVenture','readyVenture','cancelVenture','resolveVenture') THEN
   IF mto_rank(p.xp)<2 THEN RAISE EXCEPTION 'Joint ventures unlock at Thug'; END IF;
   IF aid IS NULL THEN RAISE EXCEPTION 'Join an alliance first'; END IF;
   IF action_kind='createVenture' THEN
     IF EXISTS(SELECT 1 FROM mto_ventures WHERE status='open' AND expires_at>now() AND (host=pid OR partner=pid)) THEN RAISE EXCEPTION 'Finish or cancel your current venture first'; END IF;
     INSERT INTO mto_ventures(alliance_id,host) VALUES(aid,pid);msg:='Opened a joint tournament venture. Waiting for an alliance partner';
   ELSE
     SELECT * INTO v FROM mto_ventures WHERE id=(input->>'id')::uuid FOR UPDATE;
     IF NOT FOUND OR v.alliance_id<>aid OR v.status<>'open' OR v.expires_at<=now() THEN RAISE EXCEPTION 'Venture is no longer open'; END IF;
     IF action_kind='joinVenture' THEN
       IF v.host=pid OR v.partner IS NOT NULL THEN RAISE EXCEPTION 'Venture already has its participants'; END IF;
       IF EXISTS(SELECT 1 FROM mto_ventures WHERE status='open' AND expires_at>now() AND (host=pid OR partner=pid)) THEN RAISE EXCEPTION 'Finish your current venture first'; END IF;
       UPDATE mto_ventures SET partner=pid WHERE id=v.id;msg:='Joined venture. Both managers must mark ready';
     ELSE
       IF pid<>v.host AND pid IS DISTINCT FROM v.partner THEN RAISE EXCEPTION 'You are not a participant'; END IF;
       IF action_kind='cancelVenture' THEN UPDATE mto_ventures SET status='cancelled' WHERE id=v.id;msg:='Venture cancelled. No entry costs were charged';
       ELSIF action_kind='readyVenture' THEN
         IF p.cash<80 OR p.energy<10 THEN RAISE EXCEPTION 'Readiness requires £80 and 10 energy'; END IF;
         IF (p.cooldowns->>'venture')::timestamptz>now() THEN RAISE EXCEPTION 'Joint ventures are cooling down'; END IF;
         UPDATE mto_ventures SET host_ready=CASE WHEN host=pid THEN NOT host_ready ELSE host_ready END,partner_ready=CASE WHEN partner=pid THEN NOT partner_ready ELSE partner_ready END WHERE id=v.id;
         msg:='Readiness updated. Both clubs are checked again when the host starts';
       ELSE
         IF pid<>v.host OR v.partner IS NULL OR NOT v.host_ready OR NOT v.partner_ready THEN RAISE EXCEPTION 'Only the host can start, after both managers are ready'; END IF;
         IF NOT EXISTS(SELECT 1 FROM mto_members WHERE player_id=v.partner AND alliance_id=aid) THEN RAISE EXCEPTION 'Partner is no longer in your alliance'; END IF;
         other:=mto_refresh(v.partner);
         IF p.cash<80 OR other.cash<80 OR p.energy<10 OR other.energy<10 THEN RAISE EXCEPTION 'Both clubs need £80 and 10 energy'; END IF;
         IF (p.cooldowns->>'venture')::timestamptz>now() OR (other.cooldowns->>'venture')::timestamptz>now() THEN RAISE EXCEPTION 'A participant is cooling down'; END IF;
         won:=random()*100<least(90,65+(mto_power(p)+mto_power(other))/20);
         fee:=80;amount:=CASE WHEN won THEN 400 ELSE 0 END;
         UPDATE mto_players SET cash=cash+amount-fee,energy=energy-10,xp=xp+CASE WHEN won THEN 550 ELSE 25 END,cooldowns=jsonb_set(cooldowns,'{venture}',to_jsonb(now()+interval '30 minutes')) WHERE id=v.partner;
         UPDATE mto_players SET energy=energy-10,xp=xp+CASE WHEN won THEN 550 ELSE 25 END,cooldowns=jsonb_set(cooldowns,'{venture}',to_jsonb(now()+interval '30 minutes')) WHERE id=pid;
         UPDATE mto_ventures SET status='complete',success=won WHERE id=v.id;
         msg:=CASE WHEN won THEN 'Joint tournament succeeded. Each club earned £400 before its £80 entry cost' ELSE 'Joint tournament fell short. Each club spent £80 and 10 energy' END;
         INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(v.partner,'venture',msg,amount-fee);
       END IF;
     END IF;
   END IF;
 ELSE RAISE EXCEPTION 'Unknown empire action'; END IF;
 UPDATE mto_players SET cash=cash+amount-fee WHERE id=pid RETURNING * INTO p;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(pid,CASE WHEN action_kind IN ('buyGoods','sellGoods') THEN 'trade' ELSE 'empire' END,msg,amount-fee);
 result:=jsonb_build_object('success',won,'message',msg,'cashDelta',amount-fee,'player',mto_public(p),'serverTime',now());
 INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,result);
 RETURN result;
END $$;
INSERT INTO mto_migrations(version) VALUES(10);
