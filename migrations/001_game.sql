BEGIN;
CREATE TABLE IF NOT EXISTS mto_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mto_ranks(id integer PRIMARY KEY, name text UNIQUE NOT NULL, threshold bigint UNIQUE NOT NULL CHECK(threshold>=0));
INSERT INTO mto_ranks VALUES (0,'Scum',0),(1,'Pee Wee',450),(2,'Thug',1500),(3,'Gangster',4000),(4,'Hitman',9000),(5,'Assassin',18000),(6,'Boss',35000),(7,'Respectable Boss',65000),(8,'Godfather',110000),(9,'Respectable Godfather',180000),(10,'Don',290000),(11,'Respectable Don',460000),(12,'Legendary Don',750000);
CREATE TABLE mto_activities(id text PRIMARY KEY,title text NOT NULL, description text NOT NULL, category text NOT NULL, tier integer NOT NULL, rank_required integer NOT NULL REFERENCES mto_ranks, cost integer NOT NULL CHECK(cost>=0),reward integer NOT NULL CHECK(reward>cost),energy integer NOT NULL CHECK(energy>0),seconds integer NOT NULL CHECK(seconds>0),chance integer NOT NULL,progress integer NOT NULL,asset boolean NOT NULL DEFAULT false);
INSERT INTO mto_activities VALUES
('flyers','Deliver Flyers','Get the neighbourhood talking. Every empire starts on a street corner.','office',1,0,0,30,3,15,68,12,false),
('coaching','Community Coaching','Put the cones out. Build a name on the local pitch.','office',1,0,0,45,5,20,65,16,false),
('sponsor','Local Sponsorship','Turn a good reputation into a deal with a local business.','office',2,1,40,125,8,35,48,28,false),
('kit','Regional Kit Deal','Get your colours into shops across South Yorkshire.','office',3,2,100,330,12,75,40,50,false),
('cup','Regional Cup','Bring a competitive tournament to your home ground.','office',3,3,250,750,18,120,38,80,false),
('exhibition','National Exhibition','Organise a showcase with a national audience.','office',4,4,600,1800,25,180,32,135,false),
('broadcast','Broadcast Partnership','Negotiate your place on the biggest screens.','office',5,6,1800,5500,35,300,25,220,false),
('global','Global Football Rights','Take your football business around the world.','office',5,9,6000,18000,45,600,20,400,false),
('scout','Scout Local Talent','Watch a local fixture and try to find your next signing.','scouting',1,1,25,70,6,35,55,25,true),
('agents','Talk to Local Agents','Build your contacts and recruit a promising player.','recruitment',1,1,60,150,8,45,48,32,true),
('trials','Youth Trials','Host open trials for ambitious young talent.','recruitment',2,2,120,300,12,75,40,55,true),
('professional','Professional Deals','Find the right deal with an established professional.','recruitment',3,4,400,1000,20,180,32,90,true),
('elite','Elite Representatives','Work the network of the most influential agents.','recruitment',4,7,1500,4000,30,300,25,150,true),
('legend','Football Legends','Bring a generational talent into your club.','recruitment',5,10,5000,14000,40,600,18,250,true);
CREATE TABLE mto_items(id text PRIMARY KEY,title text NOT NULL,slot text NOT NULL,price integer NOT NULL CHECK(price>0),power integer NOT NULL,rank_required integer NOT NULL REFERENCES mto_ranks,description text NOT NULL);
INSERT INTO mto_items VALUES
('boots','Touchline Boots','feet',120,3,0,'Reliable boots for long days on the training ground.'),
('jacket','Club Tracksuit','body',220,5,0,'Look the part. Lead the club.'),
('clipboard','Tactics Board','hands',400,8,1,'A clear plan gives your club an edge.'),
('watch','Matchday Watch','accessory',750,12,2,'Timing is everything.'),
('headset','Coaching Headset','hands',1800,20,3,'Keep every part of the operation connected.'),
('suit','Executive Suit','body',4500,35,5,'A presence in every boardroom.'),
('analysis','Analysis Tablet','accessory',10000,55,7,'Find the margins that win competitions.'),
('legacy','Legacy Boots','feet',25000,85,10,'For a manager who has been everywhere.');
CREATE TABLE mto_players(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),identity text UNIQUE NOT NULL,name text NOT NULL CHECK(char_length(name) BETWEEN 2 AND 24),club text NOT NULL CHECK(char_length(club) BETWEEN 2 AND 32),cash bigint NOT NULL DEFAULT 250 CHECK(cash>=0),bank bigint NOT NULL DEFAULT 0 CHECK(bank>=0),xp bigint NOT NULL DEFAULT 0 CHECK(xp>=0),energy integer NOT NULL DEFAULT 100 CHECK(energy BETWEEN 0 AND 100),energy_at timestamptz NOT NULL DEFAULT now(),cooldowns jsonb NOT NULL DEFAULT '{}',mastery jsonb NOT NULL DEFAULT '{}',inventory jsonb NOT NULL DEFAULT '[]',squad jsonb NOT NULL DEFAULT '[]',attributes jsonb NOT NULL DEFAULT '{"fitness":1,"focus":1,"leadership":1,"resilience":1}',region text NOT NULL DEFAULT 'Rotherham',wins integer NOT NULL DEFAULT 0,actions integer NOT NULL DEFAULT 0,chapter integer NOT NULL DEFAULT 0,facility integer NOT NULL DEFAULT 0,last_seen timestamptz NOT NULL DEFAULT now(),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX mto_players_presence ON mto_players(last_seen DESC);
CREATE TABLE mto_sessions(token_hash text PRIMARY KEY,player_id uuid NOT NULL REFERENCES mto_players(id),expires_at timestamptz NOT NULL,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX mto_session_expiry ON mto_sessions(expires_at);
CREATE TABLE mto_receipts(player_id uuid REFERENCES mto_players(id),key uuid NOT NULL,result jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(player_id,key));
CREATE TABLE mto_events(id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,player_id uuid NOT NULL REFERENCES mto_players(id),kind text NOT NULL,message text NOT NULL,cash_delta bigint NOT NULL DEFAULT 0,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX mto_events_player ON mto_events(player_id,id DESC);
CREATE TABLE mto_listings(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),seller uuid NOT NULL REFERENCES mto_players(id),asset jsonb NOT NULL,price bigint NOT NULL CHECK(price BETWEEN 1 AND 1000000000),buyer uuid REFERENCES mto_players(id),created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX mto_listings_active ON mto_listings(created_at DESC) WHERE buyer IS NULL;
CREATE FUNCTION mto_rank(points bigint) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT max(id) FROM mto_ranks WHERE threshold<=points $$;
CREATE FUNCTION mto_power(p mto_players) RETURNS integer LANGUAGE sql STABLE AS $$ SELECT coalesce((SELECT sum((x->>'power')::int) FROM jsonb_array_elements(p.inventory)x WHERE (x->>'equipped')::boolean),0)::int + p.facility*5 + coalesce((p.attributes->>'leadership')::int,1) $$;
CREATE FUNCTION mto_public(p mto_players) RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT jsonb_build_object('id',p.id,'name',p.name,'club',p.club,'rank',mto_rank(p.xp),'rankName',(SELECT name FROM mto_ranks WHERE id=mto_rank(p.xp)),'cash',p.cash,'bank',p.bank,'energy',p.energy,'energyAt',p.energy_at,'cooldowns',p.cooldowns,'mastery',p.mastery,'inventory',p.inventory,'squad',p.squad,'attributes',p.attributes,'region',p.region,'wins',p.wins,'actions',p.actions,'chapter',p.chapter,'facility',p.facility,'power',mto_power(p)) $$;
CREATE FUNCTION mto_refresh(pid uuid) RETURNS mto_players LANGUAGE plpgsql AS $$
DECLARE p mto_players; ticks integer;
BEGIN
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid FOR UPDATE;
 ticks:=floor(extract(epoch FROM (now()-p.energy_at))/60);
 IF ticks>0 THEN
 p.energy:=least(100,p.energy+ticks*2);
 p.energy_at:=CASE WHEN p.energy=100 THEN now() ELSE p.energy_at+ticks*interval '1 minute' END;
 END IF;
 UPDATE mto_players SET energy=p.energy,energy_at=p.energy_at,last_seen=now() WHERE id=pid RETURNING * INTO p;
 RETURN p;
END $$;
CREATE FUNCTION mto_action(pid uuid,request_key uuid,kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; a mto_activities; item mto_items; old_result jsonb; result jsonb; cd text; due timestamptz; amount bigint; gain integer:=0; fee integer:=0; success boolean:=true; chance integer; practiced integer; before_rank integer; msg text; asset jsonb; entry jsonb; target mto_players; listing mto_listings; target_id uuid; roll double precision; region_name text; stat text;
BEGIN
 -- Lock globally ordered participant rows before refreshing for safe cross-player transactions.
 IF kind='challenge' THEN target_id:=(input->>'target')::uuid;
 ELSIF kind='buyListing' THEN SELECT seller INTO target_id FROM mto_listings WHERE id=(input->>'id')::uuid;
 END IF;
 PERFORM id FROM mto_players WHERE id IN(pid,target_id) ORDER BY id FOR UPDATE;
 SELECT r.result INTO old_result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;
 IF FOUND THEN RETURN old_result; END IF;
 p:=mto_refresh(pid); before_rank:=mto_rank(p.xp);
 IF kind='activity' THEN
 SELECT * INTO a FROM mto_activities WHERE id=input->>'id';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown activity'; END IF;
 IF before_rank<a.rank_required THEN RAISE EXCEPTION 'Reach the required rank first'; END IF;
 cd:=a.id; due:=(p.cooldowns->>cd)::timestamptz;
 IF due>now() THEN RAISE EXCEPTION 'This activity is cooling down'; END IF;
 IF p.energy<a.energy THEN RAISE EXCEPTION 'Not enough energy. It recovers by 2 every minute'; END IF;
 IF p.cash<a.cost THEN RAISE EXCEPTION 'Not enough cash'; END IF;
 IF coalesce(input->>'approach','steady') NOT IN ('safe','steady','bold') THEN RAISE EXCEPTION 'Unknown approach'; END IF;
 practiced:=coalesce((p.mastery->>a.id)::integer,0);
 chance:=greatest(10,least(95,a.chance+practiced+least(6,p.facility)+CASE input->>'approach' WHEN 'safe' THEN 10 WHEN 'bold' THEN -10 ELSE 0 END));
 success:=random()*100<chance;
 gain:=CASE WHEN success THEN floor(a.reward*CASE input->>'approach' WHEN 'safe' THEN 0.8 WHEN 'bold' THEN 1.3 ELSE 1 END) ELSE 0 END;
 fee:=a.cost; p.cash:=p.cash-fee+gain; p.energy:=p.energy-a.energy;
 p.cooldowns:=jsonb_set(p.cooldowns,ARRAY[cd],to_jsonb(now()+a.seconds*interval '1 second'));
 p.mastery:=jsonb_set(p.mastery,ARRAY[a.id],to_jsonb(greatest(-20,least(30,practiced+CASE WHEN success THEN greatest(1,4-practiced/12) ELSE -3 END))));
 p.actions:=p.actions+1;
 IF success THEN
 p.xp:=p.xp+a.progress; p.wins:=p.wins+1;
 IF a.asset THEN
 roll:=random();
 asset:=jsonb_build_object('id',gen_random_uuid(),'name',(ARRAY['Alex','Jamie','Morgan','Taylor','Sam','Riley','Jordan','Casey'])[1+floor(random()*8)::int]||' '||(ARRAY['Vale','Brooks','Ash','Hart','Reed','North','Stone','Field'])[1+floor(random()*8)::int],'position',(ARRAY['GK','DEF','MID','FWD'])[1+floor(random()*4)::int],'rarity',CASE WHEN roll<0.02 THEN 'Legendary' WHEN roll<0.12 THEN 'Elite' WHEN roll<0.4 THEN 'Promising' ELSE 'Local' END,'power',a.tier*5+floor(random()*10)::int,'value',a.cost*2+40);
 p.squad:=p.squad||jsonb_build_array(asset);
 END IF;
 END IF;
 msg:=CASE WHEN success THEN a.title||' completed. Earned £'||gain||CASE WHEN a.asset THEN ' and signed '||(asset->>'name') ELSE '' END ELSE a.title||' did not come off. Try again after the cooldown' END;
 ELSIF kind IN ('deposit','withdraw') THEN
 amount:=(input->>'amount')::bigint;
 IF amount IS NULL OR amount<1 OR amount>1000000000 THEN RAISE EXCEPTION 'Enter a whole amount between 1 and 1,000,000,000'; END IF;
 IF kind='deposit' THEN IF p.cash<amount THEN RAISE EXCEPTION 'Not enough cash'; END IF; p.cash:=p.cash-amount;p.bank:=p.bank+amount;
 ELSE IF p.bank<amount THEN RAISE EXCEPTION 'Not enough savings'; END IF;p.cash:=p.cash+amount;p.bank:=p.bank-amount; END IF;
 msg:=CASE kind WHEN 'deposit' THEN 'Deposited £' ELSE 'Withdrew £' END||amount;
 ELSIF kind='buyItem' THEN
 SELECT * INTO item FROM mto_items WHERE id=input->>'id';
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown equipment'; END IF;
 IF before_rank<item.rank_required THEN RAISE EXCEPTION 'Reach the required rank first'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p.inventory)x WHERE x->>'id'=item.id) THEN RAISE EXCEPTION 'You already own this item'; END IF;
 IF p.cash<item.price THEN RAISE EXCEPTION 'Not enough cash'; END IF;
 fee:=item.price;p.cash:=p.cash-fee;
 p.inventory:=p.inventory||jsonb_build_array(jsonb_build_object('id',item.id,'title',item.title,'slot',item.slot,'power',item.power,'equipped',false));
 msg:='Purchased '||item.title;
 ELSIF kind='equip' THEN
 SELECT x INTO entry FROM jsonb_array_elements(p.inventory)x WHERE x->>'id'=input->>'id';
 IF entry IS NULL THEN RAISE EXCEPTION 'You do not own that equipment'; END IF;
 SELECT jsonb_agg(CASE WHEN x->>'slot'=entry->>'slot' THEN jsonb_set(x,'{equipped}',to_jsonb(CASE WHEN x->>'id'=entry->>'id' THEN NOT (entry->>'equipped')::boolean ELSE false END)) ELSE x END) INTO p.inventory FROM jsonb_array_elements(p.inventory)x;
 msg:='Equipment updated';
 ELSIF kind='train' THEN
 IF before_rank<1 THEN RAISE EXCEPTION 'Training unlocks at Pee Wee'; END IF;
 IF (p.cooldowns->>'training')::timestamptz>now() THEN RAISE EXCEPTION 'Training is cooling down'; END IF;
 stat:=input->>'stat';IF stat IS NULL OR NOT p.attributes ? stat THEN RAISE EXCEPTION 'Unknown attribute'; END IF;
 IF p.energy<10 OR p.cash<20 THEN RAISE EXCEPTION 'Training needs 10 energy and £20'; END IF;
 p.attributes:=jsonb_set(p.attributes,ARRAY[stat],to_jsonb((p.attributes->>stat)::int+1));p.energy:=p.energy-10;fee:=20;p.cash:=p.cash-20;p.xp:=p.xp+10;p.cooldowns:=jsonb_set(p.cooldowns,'{training}',to_jsonb(now()+interval '60 seconds'));msg:='Training complete: '||stat||' improved';
 ELSIF kind='upgrade' THEN
 IF before_rank<2 THEN RAISE EXCEPTION 'Club development unlocks at Thug'; END IF;
 IF p.facility>=10 THEN RAISE EXCEPTION 'Your training ground is fully developed'; END IF;
 fee:=500*(p.facility+1)*(p.facility+1);IF p.cash<fee THEN RAISE EXCEPTION 'Not enough cash'; END IF;
 p.cash:=p.cash-fee;p.facility:=p.facility+1;msg:='Training ground upgraded to level '||p.facility;
 ELSIF kind='travel' THEN
 IF before_rank<1 THEN RAISE EXCEPTION 'Travel unlocks at Pee Wee'; END IF;
 region_name:=input->>'region';IF region_name IS NULL OR region_name NOT IN ('Rotherham','Sheffield','Doncaster','Barnsley') OR region_name=p.region THEN RAISE EXCEPTION 'Choose another region'; END IF;
 IF (p.cooldowns->>'travel')::timestamptz>now() THEN RAISE EXCEPTION 'Your transport is cooling down'; END IF;
 IF p.cash<50 THEN RAISE EXCEPTION 'Travel costs £50'; END IF;
 fee:=50;p.cash:=p.cash-50;p.region:=region_name;p.cooldowns:=jsonb_set(p.cooldowns,'{travel}',to_jsonb(now()+interval '120 seconds'));msg:='Arrived in '||region_name;
 ELSIF kind='chapter' THEN
 IF p.chapter>=18 THEN RAISE EXCEPTION 'Your campaign is complete'; END IF;
 IF p.wins<(p.chapter+1)*10 OR before_rank<least(12,p.chapter/2) THEN RAISE EXCEPTION 'Complete the chapter objectives first'; END IF;
 gain:=100*(p.chapter+1);p.cash:=p.cash+gain;p.xp:=p.xp+30*(p.chapter+1);p.chapter:=p.chapter+1;msg:='Chapter '||p.chapter||' completed. Earned £'||gain;
 ELSIF kind='sellPlayer' OR kind='listPlayer' THEN
 SELECT x INTO asset FROM jsonb_array_elements(p.squad)x WHERE x->>'id'=input->>'id';
 IF asset IS NULL THEN RAISE EXCEPTION 'You do not own that player'; END IF;
 SELECT coalesce(jsonb_agg(x),'[]') INTO p.squad FROM jsonb_array_elements(p.squad)x WHERE x->>'id'<>input->>'id';
 IF kind='sellPlayer' THEN gain:=(asset->>'value')::int;p.cash:=p.cash+gain;msg:='Released '||(asset->>'name')||' for £'||gain;
 ELSE amount:=(input->>'amount')::bigint;IF amount IS NULL OR amount<1 OR amount>1000000000 THEN RAISE EXCEPTION 'Invalid listing price'; END IF;
 INSERT INTO mto_listings(seller,asset,price) VALUES(pid,asset,amount);msg:='Player listed on the transfer market'; END IF;
 ELSIF kind='buyListing' THEN
 SELECT * INTO listing FROM mto_listings WHERE id=(input->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR listing.buyer IS NOT NULL THEN RAISE EXCEPTION 'That listing is no longer available'; END IF;
 IF listing.seller=pid THEN RAISE EXCEPTION 'You cannot buy your own player'; END IF;
 IF p.cash<listing.price THEN RAISE EXCEPTION 'Not enough cash'; END IF;
 fee:=listing.price;p.cash:=p.cash-listing.price;p.squad:=p.squad||jsonb_build_array(listing.asset);
 UPDATE mto_players SET cash=cash+listing.price WHERE id=listing.seller;
 UPDATE mto_listings SET buyer=pid WHERE id=listing.id;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(listing.seller,'sale','Transfer completed: '||(listing.asset->>'name'),listing.price);
 msg:='Signed '||(listing.asset->>'name')||' from the transfer market';
 ELSIF kind='cancelListing' THEN
 SELECT * INTO listing FROM mto_listings WHERE id=(input->>'id')::uuid FOR UPDATE;
 IF NOT FOUND OR listing.seller<>pid OR listing.buyer IS NOT NULL THEN RAISE EXCEPTION 'Cannot withdraw this listing'; END IF;
 p.squad:=p.squad||jsonb_build_array(listing.asset);DELETE FROM mto_listings WHERE id=listing.id;msg:='Player returned to your squad';
 ELSIF kind='challenge' THEN
 IF before_rank<2 THEN RAISE EXCEPTION 'Rival challenges unlock at Thug'; END IF;
 IF target_id=pid THEN RAISE EXCEPTION 'Choose another manager'; END IF;
 SELECT * INTO target FROM mto_players WHERE id=target_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Manager not found'; END IF;
 IF mto_rank(target.xp)<2 THEN RAISE EXCEPTION 'This manager is still protected as a beginner'; END IF;
 IF (p.cooldowns->>'challenge')::timestamptz>now() THEN RAISE EXCEPTION 'Challenges are cooling down'; END IF;
 IF p.energy<15 THEN RAISE EXCEPTION 'Challenges need 15 energy'; END IF;
 p.energy:=p.energy-15;p.cooldowns:=jsonb_set(p.cooldowns,'{challenge}',to_jsonb(now()+interval '180 seconds'));
 success:=random()<(mto_power(p)+20.0)/(mto_power(p)+mto_power(target)+40.0);
 IF success THEN gain:=75;p.cash:=p.cash+gain;p.xp:=p.xp+25;p.wins:=p.wins+1; END IF;
 msg:=CASE WHEN success THEN 'You won the friendly against ' ELSE 'You lost the friendly against ' END||target.club;
 INSERT INTO mto_events(player_id,kind,message) VALUES(target.id,'challenge',p.club||' challenged your club. '||CASE WHEN success THEN 'They won.' ELSE 'You won.' END);
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;
 UPDATE mto_players SET cash=p.cash,bank=p.bank,xp=p.xp,energy=p.energy,cooldowns=p.cooldowns,mastery=p.mastery,inventory=p.inventory,squad=p.squad,attributes=p.attributes,region=p.region,wins=p.wins,actions=p.actions,chapter=p.chapter,facility=p.facility WHERE id=pid RETURNING * INTO p;
 IF mto_rank(p.xp)>before_rank THEN msg:=msg||'. Promoted to '||(SELECT name FROM mto_ranks WHERE id=mto_rank(p.xp))||'!'; END IF;
 INSERT INTO mto_events(player_id,kind,message,cash_delta) VALUES(pid,kind,msg,gain-fee);
 result:=jsonb_build_object('success',success,'message',msg,'cashDelta',gain-fee,'player',mto_public(p),'serverTime',now());
 INSERT INTO mto_receipts(player_id,key,result) VALUES(pid,request_key,result);
 RETURN result;
END $$;
INSERT INTO mto_migrations(version) VALUES(1);
COMMIT;
