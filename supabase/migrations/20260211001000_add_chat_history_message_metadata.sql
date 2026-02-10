ALTER TABLE public.chat_history
  ADD COLUMN IF NOT EXISTS client_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reply_to_client_message_id TEXT,
  ADD COLUMN IF NOT EXISTS reaction TEXT;

CREATE INDEX IF NOT EXISTS chat_history_user_gang_client_message_idx
  ON public.chat_history (user_id, gang_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS chat_history_user_gang_reply_to_idx
  ON public.chat_history (user_id, gang_id, reply_to_client_message_id)
  WHERE reply_to_client_message_id IS NOT NULL;
