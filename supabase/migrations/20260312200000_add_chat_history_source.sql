-- Phase 06A: Add source column to chat_history for message-origin tracking
-- Values: 'chat' (normal), 'wywa' (background), 'system' (system-generated)

ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'chat';

ALTER TABLE public.chat_history
  ADD CONSTRAINT chat_history_source_check
  CHECK (source IN ('chat', 'wywa', 'system'));

CREATE INDEX IF NOT EXISTS chat_history_user_source_created_idx
  ON public.chat_history (user_id, source, created_at DESC);
