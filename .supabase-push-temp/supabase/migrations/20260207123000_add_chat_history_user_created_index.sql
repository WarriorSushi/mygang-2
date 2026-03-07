-- Optimize history restore/pagination by user timeline
CREATE INDEX IF NOT EXISTS chat_history_user_created_idx
  ON public.chat_history (user_id, created_at DESC);
