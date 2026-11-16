CREATE INDEX mto_listings_seller_active ON mto_listings(seller) WHERE buyer IS NULL;
CREATE OR REPLACE FUNCTION mto_public(p mto_players) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('id',p.id,'name',p.name,'club',p.club,'rank',mto_rank(p.xp),'rankName',(SELECT name FROM mto_ranks WHERE id=mto_rank(p.xp)),'cash',p.cash,'bank',p.bank,'energy',p.energy,'energyAt',p.energy_at,'cooldowns',p.cooldowns,'mastery',p.mastery,'inventory',p.inventory,'squad',p.squad,'attributes',p.attributes,'region',p.region,'wins',p.wins,'actions',p.actions,'chapter',p.chapter,'facility',p.facility,'power',mto_power(p),'ownedCount',jsonb_array_length(p.squad)+(SELECT count(*) FROM mto_listings WHERE seller=p.id AND buyer IS NULL))
$$;
INSERT INTO mto_migrations(version) VALUES(6);
