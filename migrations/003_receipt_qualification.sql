CREATE OR REPLACE FUNCTION mto_action(pid uuid,request_key uuid,kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
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
INSERT INTO mto_migrations(version) VALUES(3);
