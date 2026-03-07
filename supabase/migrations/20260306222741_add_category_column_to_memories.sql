ALTER TABLE memories ADD COLUMN IF NOT EXISTS category text DEFAULT 'topic';
ALTER TABLE memories ADD CONSTRAINT memories_category_valid CHECK (category IN ('identity', 'preference', 'life_event', 'relationship', 'inside_joke', 'routine', 'mood', 'topic', 'compacted'));
CREATE INDEX IF NOT EXISTS memories_category_idx ON memories (user_id, category, created_at DESC);;
