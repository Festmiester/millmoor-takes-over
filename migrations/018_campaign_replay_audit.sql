-- A legacy receipt cannot be replayed with forged input to manufacture lessons.
CREATE OR REPLACE FUNCTION mto_action(pid uuid,request_key uuid,kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 SELECT r.result INTO result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;IF FOUND THEN RETURN result;END IF;
 IF kind IN ('chapter','claimCampaignPlayer') THEN RETURN mto_campaign_claim(pid,request_key,(input->>'id')::int,kind='claimCampaignPlayer');END IF;
 result:=mto_action_v14(pid,request_key,kind,input);
 INSERT INTO mto_action_log(player_id,request_key,kind,details) VALUES(pid,request_key,kind,jsonb_build_object('id',input->>'id','approach',coalesce(input->>'approach','steady'),'stat',input->>'stat','region',input->>'region')) ON CONFLICT DO NOTHING;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION mto_empire_action(pid uuid,request_key uuid,action_kind text,input jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE result jsonb;
BEGIN
 SELECT r.result INTO result FROM mto_receipts r WHERE r.player_id=pid AND r.key=request_key;IF FOUND THEN RETURN result;END IF;
 result:=mto_empire_action_v14(pid,request_key,action_kind,input);
 INSERT INTO mto_action_log(player_id,request_key,kind,details) VALUES(pid,request_key,action_kind,jsonb_build_object('id',input->>'id','quantity',input->'quantity','region',result->'player'->>'region')) ON CONFLICT DO NOTHING;
 RETURN result;
END $$;
INSERT INTO mto_migrations(version) VALUES(18);
