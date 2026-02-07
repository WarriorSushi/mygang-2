-- Performance indexes for pagination and recent-history queries
CREATE INDEX IF NOT EXISTS chat_history_user_gang_created_idx
  ON public.chat_history (user_id, gang_id, created_at DESC);

CREATE INDEX IF NOT EXISTS memories_user_created_idx
  ON public.memories (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS memories_content_trgm_idx
  ON public.memories USING gin (content gin_trgm_ops);
