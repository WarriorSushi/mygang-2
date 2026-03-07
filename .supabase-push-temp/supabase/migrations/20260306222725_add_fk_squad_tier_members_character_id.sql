ALTER TABLE squad_tier_members ADD CONSTRAINT squad_tier_members_character_id_fkey FOREIGN KEY (character_id) REFERENCES characters(id);;
