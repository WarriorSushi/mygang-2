ALTER TABLE memories ADD CONSTRAINT memories_kind_valid CHECK (kind IN ('episodic', 'semantic', 'procedural', 'compacted', 'archived', 'compacting'));;
