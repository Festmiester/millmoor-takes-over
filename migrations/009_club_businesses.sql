-- Recovered exact business functions from the verified game branch.
CREATE TABLE mto_business_catalog(id text PRIMARY KEY,title text NOT NULL,description text NOT NULL,rank_required integer NOT NULL CHECK(rank_required>=0),price integer NOT NULL CHECK(price>0),rate integer NOT NULL CHECK(rate>0));
INSERT INTO mto_business_catalog VALUES ('programmes','Matchday Programmes','Build a small programme round around the local grounds.',1,180,4),('merchandise','Merchandise Stall','Turn your club following into scarves and shirts.',3,900,14),('academy','Community Academy','Run a permanent football school with local coaching staff.',5,3000,40);
CREATE TABLE mto_businesses(player_id uuid NOT NULL REFERENCES mto_players(id),business_id text NOT NULL REFERENCES mto_business_catalog(id),level integer NOT NULL DEFAULT 1 CHECK(level BETWEEN 1 AND 5),collected_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(player_id,business_id));
CREATE OR REPLACE FUNCTION public.mto_business_action(pid uuid, request_key uuid, action_kind text, bid text)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE p mto_players; c mto_business_catalog; b mto_businesses;
 previous jsonb; result jsonb; amount integer:=0; fee integer:=0;
 ticks integer:=0; msg text;
BEGIN
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
 SELECT r.result INTO previous FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;
 IF FOUND THEN RETURN previous; END IF;
 SELECT * INTO c FROM mto_business_catalog WHERE id=bid;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown club business'; END IF;
 SELECT * INTO b FROM mto_businesses WHERE player_id=pid AND business_id=bid FOR UPDATE;
 IF action_kind='buyBusiness' THEN
   IF b.player_id IS NOT NULL THEN RAISE EXCEPTION 'You already own this business'; END IF;
   IF mto_rank(p.xp)<c.rank_required THEN RAISE EXCEPTION 'Earn the required rank first'; END IF;
   fee:=c.price;
   IF p.cash<fee THEN RAISE EXCEPTION 'Not enough cash to open this business'; END IF;
   INSERT INTO mto_businesses(player_id,business_id) VALUES(pid,bid);
   msg:='Opened '||c.title||'. Earnings build every 10 minutes';
 ELSIF action_kind IN ('collectBusiness','upgradeBusiness') THEN
   IF b.player_id IS NULL THEN RAISE EXCEPTION 'Open this business first'; END IF;
   ticks:=least(48,greatest(0,floor(extract(epoch FROM now()-b.collected_at)/600)))::integer;
   amount:=ticks*c.rate*b.level;
   IF action_kind='collectBusiness' THEN
     IF ticks=0 THEN RAISE EXCEPTION 'The next earnings cycle is not ready'; END IF;
     -- Preserve partial cycles; when capped, excess offline time is forfeited.
     UPDATE mto_businesses SET collected_at=CASE WHEN now()-b.collected_at>=interval '8 hours'
       THEN now() ELSE b.collected_at+ticks*interval '10 minutes' END
       WHERE player_id=pid AND business_id=bid;
     msg:='Collected £'||amount||' from '||c.title;
   ELSE
     IF b.level>=5 THEN RAISE EXCEPTION 'Business is already fully upgraded'; END IF;
     fee:=c.price*(b.level+1);
     IF p.cash<fee THEN RAISE EXCEPTION 'Not enough cash for this business upgrade'; END IF;
     -- Settle completed cycles at the OLD level, then start a fresh cycle.
     UPDATE mto_businesses SET level=level+1,collected_at=now()
       WHERE player_id=pid AND business_id=bid;
     msg:='Upgraded '||c.title||' to level '||(b.level+1)||'. Collected £'||amount||' at the old rate';
   END IF;
 ELSE RAISE EXCEPTION 'Unknown business action'; END IF;
 p:=mto_refresh(pid);
 UPDATE mto_players SET cash=cash+amount-fee WHERE id=pid RETURNING * INTO p;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(pid,'business',msg,amount-fee);
 result:=jsonb_build_object('success',true,'message',msg,'cashDelta',amount-fee,
   'player',mto_public(p),'serverTime',now());
 INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,result);
 RETURN result;
END $function$
;
CREATE OR REPLACE FUNCTION public.mto_business_status(pid uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
 SELECT jsonb_build_object('serverTime',now(),'tickSeconds',600,'capTicks',48,
 'businesses', (SELECT jsonb_agg(jsonb_build_object(
 'id',c.id,'title',c.title,'description',c.description,'rankRequired',c.rank_required,
 'price',c.price,'baseRate',c.rate,'level',coalesce(b.level,0),
 'rate',c.rate*coalesce(b.level,1),
 'upgradeCost',CASE WHEN b.level<5 THEN c.price*(b.level+1) ELSE NULL END,
 'collectedAt',b.collected_at,
 'available',CASE WHEN b.level IS NULL THEN 0 ELSE
 least(48,greatest(0,floor(extract(epoch FROM now()-b.collected_at)/600)))::integer*c.rate*b.level END
 ) ORDER BY c.rank_required) FROM mto_business_catalog c
 LEFT JOIN mto_businesses b ON b.business_id=c.id AND b.player_id=pid))
$function$
;
INSERT INTO mto_migrations(version) VALUES(9);

