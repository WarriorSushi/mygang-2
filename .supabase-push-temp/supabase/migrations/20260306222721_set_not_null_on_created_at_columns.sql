ALTER TABLE chat_history ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE gang_members ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE gangs ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE memories ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE analytics_events ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE billing_events ALTER COLUMN created_at SET NOT NULL;;
