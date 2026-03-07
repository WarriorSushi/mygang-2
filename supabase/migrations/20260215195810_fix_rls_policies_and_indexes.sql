
-- 1. Add DELETE policy on chat_history (deleteAllMessages was silently broken)
CREATE POLICY "Users can delete their chat history"
  ON public.chat_history FOR DELETE
  USING (auth.uid() = user_id);

-- 2. Add UPDATE policy on chat_history
CREATE POLICY "Users can update their chat history"
  ON public.chat_history FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. Fix guest RLS bypass - drop old overly permissive policies and recreate
DROP POLICY IF EXISTS "Users can view their chat history" ON public.chat_history;
DROP POLICY IF EXISTS "Users can insert their chat history" ON public.chat_history;

CREATE POLICY "Users can view their chat history"
  ON public.chat_history FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their chat history"
  ON public.chat_history FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4. Enable RLS on characters table with SELECT-only public policy
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read characters"
  ON public.characters FOR SELECT
  USING (true);

-- 5. Add HNSW index on memories.embedding for vector similarity search
CREATE INDEX IF NOT EXISTS memories_embedding_hnsw_idx
  ON public.memories USING hnsw (embedding vector_cosine_ops);

-- 6. Add composite index on memories for kind-based queries
CREATE INDEX IF NOT EXISTS memories_user_kind_created_idx
  ON public.memories (user_id, kind, created_at DESC);

-- 7. Add updated_at trigger on profiles
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 8. Add CHECK constraints
ALTER TABLE public.profiles
  ADD CONSTRAINT daily_msg_count_range CHECK (daily_msg_count >= 0 AND daily_msg_count <= 10000);

ALTER TABLE public.profiles
  ADD CONSTRAINT abuse_score_range CHECK (abuse_score >= 0 AND abuse_score <= 1000);

-- 9. Remove redundant overlapping SELECT policy on gangs
DROP POLICY IF EXISTS "Users can view their own gang" ON public.gangs;
;
