-- Tutorial campaign v2 is separate from legacy chapters. No account reset.
UPDATE mto_ranks r SET name=v.name FROM (VALUES
 (0,'Sunday League Dreamer'),(1,'Grassroots Manager'),(2,'Local Gaffer'),
 (3,'Non-League Boss'),(4,'Semi-Pro Manager'),(5,'Professional Manager'),
 (6,'League Manager'),(7,'Promotion Specialist'),(8,'Championship Contender'),
 (9,'Premier League Manager'),(10,'Title Challenger'),(11,'European Elite'),(12,'Football Legend')
)v(id,name) WHERE r.id=v.id;
-- Substitute legacy rank labels in function messages without recursive replacements.
DO $$
DECLARE f record; definition text; updated text; names text[]:=ARRAY['Scum','Pee Wee','Thug','Gangster','Hitman','Assassin','Boss','Respectable Boss','Godfather','Respectable Godfather','Don','Respectable Don','Legendary Don']; i integer;
BEGIN
 FOR f IN SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'mto_%' AND p.prokind='f' LOOP
  definition:=pg_get_functiondef(f.oid);updated:=definition;
  FOR i IN SELECT x FROM generate_subscripts(names,1)x ORDER BY length(names[x]) DESC LOOP updated:=replace(updated,names[i],'__MTO_LABEL_'||i||'__'); END LOOP;
  FOR i IN 1..13 LOOP updated:=replace(updated,'__MTO_LABEL_'||i||'__',(SELECT name FROM mto_ranks WHERE id=i-1)); END LOOP;
  IF updated<>definition THEN EXECUTE updated; END IF;
 END LOOP;
END $$;
ALTER TABLE mto_items ADD COLUMN campaign_only boolean NOT NULL DEFAULT false;
INSERT INTO mto_items(id,title,slot,price,power,rank_required,description,campaign_only) VALUES
 ('campaign_console','Legacy Tactics Console','hands',40000,110,10,'Earned by building a lasting football institution.',true),
 ('campaign_crest','Legend''s Crest','accessory',75000,140,12,'The final Road to Legend reward. A symbol with real club power.',true);
CREATE TABLE mto_action_log(player_id uuid REFERENCES mto_players(id),request_key uuid NOT NULL,kind text NOT NULL,details jsonb NOT NULL DEFAULT '{}',created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(player_id,request_key));
CREATE TABLE mto_campaign_chapters(id integer PRIMARY KEY CHECK(id BETWEEN 1 AND 18),title text NOT NULL,lesson text NOT NULL,rank_required integer NOT NULL REFERENCES mto_ranks(id),goals jsonb NOT NULL,cash integer NOT NULL CHECK(cash>=0),item_id text REFERENCES mto_items(id),player_reward jsonb);
CREATE TABLE mto_campaign_claims(player_id uuid REFERENCES mto_players(id),chapter_id integer REFERENCES mto_campaign_chapters(id),claimed_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(player_id,chapter_id));
CREATE TABLE mto_campaign_players(player_id uuid REFERENCES mto_players(id),chapter_id integer REFERENCES mto_campaign_chapters(id),asset jsonb NOT NULL,claimed_at timestamptz,PRIMARY KEY(player_id,chapter_id));
INSERT INTO mto_campaign_chapters VALUES
 (1,'Boots on the Ground','Start with the two grassroots activities. Attempts count even when a move falls short.',0,'[{"metric":"flyers","target":3,"label":"Deliver Flyers three times","route":"office"},{"metric":"coaching","target":2,"label":"Run two Community Coaching sessions","route":"office"}]',100,'boots',NULL),
 (2,'Safe Hands','Use the bank to protect savings, then withdraw some spending money. Neither transfer gives rank progress.',0,'[{"metric":"deposit","target":1,"label":"Make a bank deposit","route":"bank"},{"metric":"withdraw","target":1,"label":"Make a bank withdrawal","route":"bank"}]',75,'jacket',NULL),
 (3,'A Plan for Matchday','Equip one of your rewards and try two different approaches. Safe, Steady and Bold change actual odds and payouts.',0,'[{"metric":"equipped","target":1,"label":"Equip an item","route":"profile"},{"metric":"approaches","target":2,"label":"Complete activities using two approaches","route":"office"}]',125,'clipboard',NULL),
 (4,'Put in the Work','Keep playing grassroots activities to earn Grassroots Manager. Fitness improves stamina capacity; focus helps club power and activity odds.',1,'[{"metric":"fitness","target":2,"label":"Train Fitness to level 2","route":"training"},{"metric":"focus","target":2,"label":"Train Focus to level 2","route":"training"}]',150,NULL,'{"name":"Jamie Vale","position":"DEF","rarity":"Local","power":8,"value":120,"age":19}'),
 (5,'Build Your Contacts','Scouting and recruitment produce permanent owned players. Their value is additional to the displayed cash return.',1,'[{"metric":"scouting","target":1,"label":"Attempt a talent scout","route":"scouting"},{"metric":"recruitment","target":1,"label":"Attempt a recruitment deal","route":"recruitment"},{"metric":"owned","target":1,"label":"Own at least one player","route":"squad"}]',200,NULL,'{"name":"Taylor Reed","position":"FWD","rarity":"Promising","power":14,"value":300,"age":20}'),
 (6,'The Merchandise Run','This is the football bootlegging loop: buy scarves, shirts or programmes, carry them and sell. Watch the dealer spread and trade timer.',1,'[{"metric":"goods_bought","target":5,"label":"Buy five merchandise units","route":"trading"},{"metric":"goods_sold","target":3,"label":"Sell three merchandise units","route":"trading"}]',250,'watch',NULL),
 (7,'Take It on the Road','Compare city quotes before travelling. Budget the £50 travel cost and sell carried merchandise away from Rotherham. A sale is not guaranteed to be profitable.',1,'[{"metric":"travel","target":1,"label":"Travel to another town","route":"travel"},{"metric":"away_sales","target":1,"label":"Sell a merchandise unit outside Rotherham","route":"trading"}]',300,NULL,NULL),
 (8,'Local Connections','Use the location board and build an alliance. You can found an alliance alone; this tutorial does not depend on another human being online.',2,'[{"metric":"board","target":1,"label":"Post to the community board","route":"board"},{"metric":"alliance","target":1,"label":"Join or found an alliance","route":"alliance"}]',350,NULL,NULL),
 (9,'The Transfer Desk','A listing moves a player into escrow. List one player and withdraw the listing to learn the market without losing that player.',2,'[{"metric":"listing","target":1,"label":"Create a transfer listing","route":"squad"},{"metric":"cancel_listing","target":1,"label":"Withdraw a transfer listing","route":"market"}]',400,NULL,'{"name":"Alex North","position":"MID","rarity":"Promising","power":20,"value":600,"age":21}'),
 (10,'A Club That Earns','Businesses earn while you are away. Collect completed income cycles before their eight-hour storage limit fills.',3,'[{"metric":"businesses","target":1,"label":"Own a business","route":"businesses"},{"metric":"business_collect","target":1,"label":"Collect business income","route":"businesses"}]',500,'headset',NULL),
 (11,'Build the Foundations','Upgrade facilities and train the rest of your attributes. Facilities affect power and activity odds; resilience and leadership affect power.',3,'[{"metric":"facility","target":2,"label":"Reach facility level 2","route":"club"},{"metric":"resilience","target":2,"label":"Train Resilience to level 2","route":"training"},{"metric":"leadership","target":2,"label":"Train Leadership to level 2","route":"training"}]',600,NULL,NULL),
 (12,'Bigger Opportunities','Higher rank opens tougher activity tiers and wider scout networks. Judge cost, stamina, chance and the value of any player reward together.',4,'[{"metric":"office3","target":3,"label":"Complete three Tier 3+ office attempts","route":"office"},{"metric":"scouting2","target":2,"label":"Attempt two County-or-higher scouts","route":"scouting"}]',750,NULL,'{"name":"Morgan Hart","position":"DEF","rarity":"Elite","power":30,"value":1500,"age":22}'),
 (13,'Organised Football','Complete a venture with another manager or three owned players. An unsuccessful completed venture still teaches the system and counts.',5,'[{"metric":"ventures","target":1,"label":"Complete one human or squad venture","route":"ventures"},{"metric":"owned","target":3,"label":"Own three players","route":"squad"}]',1000,'suit',NULL),
 (14,'The National Spotlight','Build stronger passive income and work higher-tier opportunities. Failure still costs entry money and stamina, so keep a reserve.',6,'[{"metric":"office4","target":3,"label":"Complete three Tier 4+ office attempts","route":"office"},{"metric":"business_level","target":3,"label":"Upgrade a business to level 3","route":"businesses"}]',1250,'analysis',NULL),
 (15,'An Elite Network','International scouting and a stronger playing squad prepare your club for larger ventures. Listed players are not available for squad ventures.',7,'[{"metric":"scouting4","target":2,"label":"Attempt two International-or-higher scouts","route":"scouting"},{"metric":"squad_power","target":90,"label":"Build 90 total available-player power","route":"squad"}]',1500,NULL,'{"name":"Jordan Brooks","position":"MID","rarity":"Elite","power":45,"value":2500,"age":24}'),
 (16,'The Global Stage','Your rank now opens top-tier business. Develop the ground as well as chasing large payouts.',9,'[{"metric":"office5","target":3,"label":"Complete three Tier 5 office attempts","route":"office"},{"metric":"facility","target":5,"label":"Reach facility level 5","route":"club"}]',2000,'legacy',NULL),
 (17,'A Football Institution','Build an established income stream, a strong squad and a daily playing habit. Previously completed daily claims count.',10,'[{"metric":"business_level","target":5,"label":"Fully upgrade a business","route":"businesses"},{"metric":"squad_power","target":150,"label":"Build 150 available-player power","route":"squad"},{"metric":"daily","target":3,"label":"Claim three daily assignments","route":"daily"}]',3000,'campaign_console',NULL),
 (18,'A Legend of the Game','Earn Football Legend through actual gameplay, use the highest scout network and prove your club can organise repeated ventures and merchandise runs.',12,'[{"metric":"ventures","target":3,"label":"Complete three ventures","route":"ventures"},{"metric":"scouting5","target":2,"label":"Attempt two World-Class scouts","route":"scouting"},{"metric":"away_sales","target":10,"label":"Sell ten merchandise units outside Rotherham","route":"trading"}]',5000,'campaign_crest','{"name":"Casey Sterling","position":"FWD","rarity":"Legendary","power":80,"value":10000,"age":25}');
CREATE FUNCTION mto_campaign_metrics(pid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH p AS (SELECT * FROM mto_players WHERE id=pid), events AS (SELECT * FROM mto_events WHERE player_id=pid),
 activity AS (SELECT a.category,a.tier,a.id,count(*) AS n FROM events e JOIN mto_activities a ON e.kind='activity' AND e.message LIKE a.title||'%' GROUP BY a.category,a.tier,a.id)
 SELECT jsonb_build_object(
 'flyers',coalesce((SELECT sum(n) FROM activity WHERE id='flyers'),0),'coaching',coalesce((SELECT sum(n) FROM activity WHERE id='coaching'),0),
 'scouting',coalesce((SELECT sum(n) FROM activity WHERE category='scouting'),0),'recruitment',coalesce((SELECT sum(n) FROM activity WHERE category='recruitment'),0),
 'office3',coalesce((SELECT sum(n) FROM activity WHERE category='office' AND tier>=3),0),'office4',coalesce((SELECT sum(n) FROM activity WHERE category='office' AND tier>=4),0),'office5',coalesce((SELECT sum(n) FROM activity WHERE category='office' AND tier>=5),0),
 'scouting2',coalesce((SELECT sum(n) FROM activity WHERE category='scouting' AND tier>=2),0),'scouting4',coalesce((SELECT sum(n) FROM activity WHERE category='scouting' AND tier>=4),0),'scouting5',coalesce((SELECT sum(n) FROM activity WHERE category='scouting' AND tier>=5),0),
 'deposit',(SELECT count(*) FROM events WHERE kind='deposit'),'withdraw',(SELECT count(*) FROM events WHERE kind='withdraw'),'travel',(SELECT count(*) FROM events WHERE kind='travel'),
 'equipped',greatest((SELECT count(*) FROM jsonb_array_elements(p.inventory)x WHERE coalesce((x->>'equipped')::boolean,false)),(SELECT count(*) FROM events WHERE kind='equip')),
 'approaches',(SELECT count(DISTINCT coalesce(details->>'approach','steady')) FROM mto_action_log WHERE player_id=pid AND kind='activity'),
 'fitness',coalesce((p.attributes->>'fitness')::int,1),'focus',coalesce((p.attributes->>'focus')::int,1),'resilience',coalesce((p.attributes->>'resilience')::int,1),'leadership',coalesce((p.attributes->>'leadership')::int,1),
 'owned',jsonb_array_length(p.squad)+(SELECT count(*) FROM mto_listings WHERE seller=pid AND buyer IS NULL),'squad_power',coalesce((SELECT sum((a->>'power')::int) FROM jsonb_array_elements(p.squad)a),0),
 'goods_bought',coalesce((SELECT sum((substring(message FROM '^Bought ([0-9]+) '))::int) FROM events WHERE kind='trade'),0),
 'goods_sold',coalesce((SELECT sum((substring(message FROM '^Sold ([0-9]+) '))::int) FROM events WHERE kind='trade'),0),
 'away_sales',coalesce((SELECT sum((substring(message FROM '^Sold ([0-9]+) '))::int) FROM events WHERE kind='trade' AND message NOT LIKE '% in Rotherham'),0),
 'listing',(SELECT count(*) FROM mto_listings WHERE seller=pid),'cancel_listing',(SELECT count(*) FROM events WHERE kind='cancelListing'),
 'board',(SELECT count(*) FROM mto_board_posts WHERE author=pid),'alliance',(SELECT count(*) FROM mto_members WHERE player_id=pid),
 'businesses',(SELECT count(*) FROM mto_businesses WHERE player_id=pid),'business_level',coalesce((SELECT max(level) FROM mto_businesses WHERE player_id=pid),0),
 'business_collect',(SELECT count(*) FROM events WHERE kind='business' AND message LIKE 'Collected %'),
 'ventures',(SELECT count(*) FROM events WHERE kind='venture' OR (kind='empire' AND message LIKE 'Joint tournament %')),
 'facility',p.facility,'daily',(SELECT count(*) FROM mto_daily_claims WHERE player_id=pid)) FROM p
$$;
CREATE FUNCTION mto_campaign_status(pid uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE p mto_players; metrics jsonb; c mto_campaign_chapters; g jsonb; goals jsonb; chapters jsonb:='[]'; next_id integer; done boolean; ready boolean; progress numeric; item mto_items; reward jsonb;
BEGIN
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid;metrics:=mto_campaign_metrics(pid);
 SELECT min(id) INTO next_id FROM mto_campaign_chapters c WHERE NOT EXISTS(SELECT 1 FROM mto_campaign_claims cl WHERE cl.player_id=pid AND cl.chapter_id=c.id);
 FOR c IN SELECT * FROM mto_campaign_chapters ORDER BY id LOOP
  goals:='[]';ready:=true;
  FOR g IN SELECT * FROM jsonb_array_elements(c.goals) LOOP
   progress:=least((g->>'target')::numeric,coalesce((metrics->>(g->>'metric'))::numeric,0));
   goals:=goals||jsonb_build_array(g||jsonb_build_object('progress',progress,'complete',progress>=(g->>'target')::numeric));
   ready:=ready AND progress>=(g->>'target')::numeric;
  END LOOP;
  SELECT * INTO item FROM mto_items WHERE id=c.item_id;
  reward:=jsonb_build_object('cash',c.cash,'item',CASE WHEN c.item_id IS NULL THEN NULL ELSE jsonb_build_object('title',item.title,'slot',item.slot,'power',item.power,'duplicateCash',item.price) END,'player',c.player_reward);
  done:=EXISTS(SELECT 1 FROM mto_campaign_claims WHERE player_id=pid AND chapter_id=c.id);
  chapters:=chapters||jsonb_build_array(jsonb_build_object('id',c.id,'title',c.title,'lesson',c.lesson,'rankRequired',c.rank_required,'rankName',(SELECT name FROM mto_ranks WHERE id=c.rank_required),'goals',goals,'reward',reward,'claimed',done,'current',c.id=next_id,'ready',c.id=next_id AND ready AND mto_rank(p.xp)>=c.rank_required));
 END LOOP;
 RETURN jsonb_build_object('version',2,'current',next_id,'completed',(SELECT count(*) FROM mto_campaign_claims WHERE player_id=pid),'legacyCompleted',p.chapter,'chapters',chapters,'pendingPlayers',coalesce((SELECT jsonb_agg(jsonb_build_object('chapter',chapter_id,'asset',asset)) FROM mto_campaign_players WHERE player_id=pid AND claimed_at IS NULL),'[]'::jsonb));
END $$;
CREATE FUNCTION mto_campaign_claim(pid uuid,request_key uuid,chapter_number integer,player_only boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; old_result jsonb; result jsonb; status jsonb; chapter jsonb; c mto_campaign_chapters; item mto_items; asset jsonb; income integer; owned integer; msg text; pending boolean:=false;
BEGIN
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
 SELECT r.result INTO old_result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;IF FOUND THEN RETURN old_result;END IF;
 SELECT jsonb_array_length(p.squad)+count(*)::int INTO owned FROM mto_listings WHERE seller=pid AND buyer IS NULL;
 IF player_only THEN
  SELECT cp.asset INTO asset FROM mto_campaign_players cp WHERE cp.player_id=pid AND cp.chapter_id=chapter_number AND cp.claimed_at IS NULL FOR UPDATE;
  IF asset IS NULL THEN RAISE EXCEPTION 'No reserved campaign player is waiting'; END IF;
  IF owned>=30 THEN RAISE EXCEPTION 'Make room in your 30-player ownership limit first'; END IF;
  UPDATE mto_campaign_players SET claimed_at=now() WHERE player_id=pid AND chapter_id=chapter_number;
  UPDATE mto_players SET squad=squad||jsonb_build_array(asset) WHERE id=pid RETURNING * INTO p;
  income:=0;msg:='Collected reserved campaign player '||(asset->>'name');
 ELSE
  status:=mto_campaign_status(pid);
  IF chapter_number IS NULL OR chapter_number IS DISTINCT FROM (status->>'current')::int THEN RAISE EXCEPTION 'Open Road to Legend and claim the current guided chapter'; END IF;
  SELECT x INTO chapter FROM jsonb_array_elements(status->'chapters')x WHERE (x->>'id')::int=chapter_number;
  IF NOT coalesce((chapter->>'ready')::boolean,false) THEN RAISE EXCEPTION 'Complete the guided objectives and required rank first'; END IF;
  SELECT * INTO STRICT c FROM mto_campaign_chapters WHERE id=chapter_number;income:=c.cash;
  IF c.item_id IS NOT NULL THEN
   SELECT * INTO STRICT item FROM mto_items WHERE id=c.item_id;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(p.inventory)x WHERE x->>'id'=item.id) THEN income:=income+item.price;
   ELSE p.inventory:=p.inventory||jsonb_build_array(jsonb_build_object('id',item.id,'title',item.title,'slot',item.slot,'power',item.power,'equipped',false));END IF;
  END IF;
  IF c.player_reward IS NOT NULL THEN
   asset:=c.player_reward||jsonb_build_object('id',gen_random_uuid());pending:=owned>=30;
   INSERT INTO mto_campaign_players(player_id,chapter_id,asset,claimed_at) VALUES(pid,chapter_number,asset,CASE WHEN pending THEN NULL ELSE now() END);
   IF NOT pending THEN p.squad:=p.squad||jsonb_build_array(asset);END IF;
  END IF;
  INSERT INTO mto_campaign_claims(player_id,chapter_id) VALUES(pid,chapter_number);
  UPDATE mto_players SET cash=cash+income,inventory=p.inventory,squad=p.squad WHERE id=pid RETURNING * INTO p;
  msg:='Guided chapter completed: '||c.title||'. Cash £'||income||CASE WHEN c.item_id IS NOT NULL THEN '. Equipment reward: '||item.title||' (cash equivalent if already owned)' ELSE '' END||CASE WHEN pending THEN '. Player reward safely reserved until squad space is available' WHEN asset IS NOT NULL THEN '. Signed '||(asset->>'name') ELSE '' END;
 END IF;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(pid,'campaign',msg,income);
 result:=jsonb_build_object('success',true,'message',msg,'cashDelta',income,'player',mto_public(p),'serverTime',now())||CASE WHEN asset IS NOT NULL AND NOT pending THEN jsonb_build_object('acquiredPlayer',asset) ELSE '{}'::jsonb END;
 INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,result);RETURN result;
END $$;
ALTER FUNCTION mto_action(uuid,uuid,text,jsonb) RENAME TO mto_action_v14;
CREATE FUNCTION mto_action(pid uuid,request_key uuid,kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 IF kind IN ('chapter','claimCampaignPlayer') THEN RETURN mto_campaign_claim(pid,request_key,(input->>'id')::int,kind='claimCampaignPlayer');END IF;
 result:=mto_action_v14(pid,request_key,kind,input);
 INSERT INTO mto_action_log(player_id,request_key,kind,details) VALUES(pid,request_key,kind,jsonb_build_object('id',input->>'id','approach',coalesce(input->>'approach','steady'),'stat',input->>'stat','region',input->>'region')) ON CONFLICT DO NOTHING;
 RETURN result;
END $$;
ALTER FUNCTION mto_empire_action(uuid,uuid,text,jsonb) RENAME TO mto_empire_action_v14;
CREATE FUNCTION mto_empire_action(pid uuid,request_key uuid,action_kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 result:=mto_empire_action_v14(pid,request_key,action_kind,input);
 INSERT INTO mto_action_log(player_id,request_key,kind,details) VALUES(pid,request_key,action_kind,jsonb_build_object('id',input->>'id','quantity',input->'quantity','region',result->'player'->>'region')) ON CONFLICT DO NOTHING;
 RETURN result;
END $$;
CREATE FUNCTION mto_merchandise_routes(pid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',g.id,'title',g.title,'markets',(SELECT jsonb_agg(jsonb_build_object('region',city,'buy',mto_goods_price(g.id,city),'sell',mto_goods_price(g.id,city)-3)) FROM unnest(ARRAY['Rotherham','Sheffield','Doncaster','Barnsley'])city)) ORDER BY g.base),'[]'::jsonb) FROM mto_goods g
$$;
INSERT INTO mto_migrations(version) VALUES(15);
