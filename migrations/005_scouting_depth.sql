-- Preserve the existing transaction engine; add capacity and richer acquired assets.
INSERT INTO mto_activities(id,title,description,category,tier,rank_required,cost,reward,energy,seconds,chance,progress,asset) VALUES
('scout_county','County Touchlines','Watch county fixtures for players ready to step up.','scouting',2,2,90,220,10,65,43,45,true),
('scout_national','National Academy Network','Work academy contacts across the country.','scouting',3,4,300,800,18,150,34,85,true),
('scout_international','International Scout Network','Follow overseas leads for exceptional football talent.','scouting',4,7,1000,2800,28,280,25,145,true),
('scout_world','World-Class Watchlist','Pursue the rarest players on the global circuit.','scouting',5,10,3500,10000,38,540,18,240,true);
CREATE FUNCTION mto_scout_profile(t integer) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_build_object('local',greatest(10,75-t*10),'promising',30,'elite',4+t*8,'legendary',1+t*2,'minPower',t*5,'maxPower',t*5+9,'capacity',30)
$$;
ALTER FUNCTION mto_action(uuid,uuid,text,jsonb) RENAME TO mto_action_v4;
CREATE FUNCTION mto_action(pid uuid,request_key uuid,kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE p mto_players; a mto_activities; old_result jsonb; result jsonb; target_id uuid; owned integer; asset jsonb; roster jsonb; profile jsonb; draw numeric; total numeric; rarity text; value integer; power integer; player_name text; attempts integer:=0;
BEGIN
 -- Match the original global row order before inspecting or updating capacity.
 IF kind='challenge' THEN target_id:=(input->>'target')::uuid;
 ELSIF kind='buyListing' THEN SELECT seller INTO target_id FROM mto_listings WHERE id=(input->>'id')::uuid;
 END IF;
 PERFORM id FROM mto_players WHERE id IN(pid,target_id) ORDER BY id FOR UPDATE;
 SELECT r.result INTO old_result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;
 IF FOUND THEN RETURN old_result; END IF;
 SELECT * INTO STRICT p FROM mto_players WHERE id=pid;
 IF kind='activity' THEN SELECT * INTO a FROM mto_activities WHERE id=input->>'id'; END IF;
 IF (kind='activity' AND a.asset) OR kind='buyListing' THEN
 SELECT jsonb_array_length(p.squad)+count(*)::int INTO owned FROM mto_listings WHERE seller=pid AND buyer IS NULL;
 IF owned>=30 THEN RAISE EXCEPTION 'Squad capacity reached (30 including listed players). Release or transfer a player first'; END IF;
 END IF;
 result:=mto_action_v4(pid,request_key,kind,input);
 IF kind='activity' AND a.asset AND (result->>'success')::boolean THEN
 SELECT squad INTO roster FROM mto_players WHERE id=pid;
 asset:=roster->(jsonb_array_length(roster)-1);
 profile:=mto_scout_profile(a.tier);
 total:=(profile->>'local')::numeric+(profile->>'promising')::numeric+(profile->>'elite')::numeric+(profile->>'legendary')::numeric;
 draw:=random()*total;
 rarity:=CASE WHEN draw<(profile->>'local')::numeric THEN 'Local' WHEN draw<(profile->>'local')::numeric+(profile->>'promising')::numeric THEN 'Promising' WHEN draw<total-(profile->>'legendary')::numeric THEN 'Elite' ELSE 'Legendary' END;
 power:=a.tier*5+floor(random()*10)::int;
 value:=greatest(a.cost*2+40,power*12)*CASE rarity WHEN 'Promising' THEN 2 WHEN 'Elite' THEN 4 WHEN 'Legendary' THEN 8 ELSE 1 END;
 LOOP
 player_name:=(ARRAY['Alex','Jamie','Morgan','Taylor','Sam','Riley','Jordan','Casey','Ellis','Harley','Drew','Cameron','Finley','Avery','Charlie','Blake'])[1+floor(random()*16)::int]||' '||(ARRAY['Vale','Brooks','Ash','Hart','Reed','North','Stone','Field','Wood','Park','Fox','Lane','Banks','Hill','Cole','West'])[1+floor(random()*16)::int];
 attempts:=attempts+1;
 EXIT WHEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(roster)x WHERE x->>'name'=player_name) OR attempts>=30;
 END LOOP;
 IF attempts>=30 THEN player_name:=player_name||' '||left(asset->>'id',4); END IF;
 asset:=asset||jsonb_build_object('name',player_name,'age',17+floor(random()*17)::int,'rarity',rarity,'power',power,'value',value);
 roster:=jsonb_set(roster,ARRAY[(jsonb_array_length(roster)-1)::text],asset);
 UPDATE mto_players SET squad=roster WHERE id=pid RETURNING * INTO p;
 result:=result||jsonb_build_object('player',mto_public(p),'acquiredPlayer',asset,'message',a.title||' completed. Signed '||player_name||' ('||rarity||'). Cash return £'||(result->>'cashDelta'));
 -- Keep promotion feedback from the original result, without exposing hidden totals.
 IF mto_rank(p.xp)>(SELECT mto_rank(xp-a.progress) FROM mto_players WHERE id=pid) THEN
 result:=jsonb_set(result,'{message}',to_jsonb((result->>'message')||'. Promoted to '||(SELECT name FROM mto_ranks WHERE id=mto_rank(p.xp))||'!'));
 END IF;
 UPDATE mto_receipts r SET result=mto_action.result WHERE r.player_id=pid AND r.key=request_key;
 UPDATE mto_events SET message=result->>'message' WHERE id=(SELECT max(id) FROM mto_events WHERE player_id=pid AND kind='activity');
 END IF;
 RETURN result;
END $$;
INSERT INTO mto_migrations(version) VALUES(5);
