-- Launch Audit Fixes (2026-03-08)
-- DB-I1: Add exception handling to handle_new_user trigger
-- DB-I2: Add CHECK constraint on memories.importance
-- PERF-I2: Add composite index for speaker-filtered chat history queries

-- DB-I1: Prevent signup failure if profile insert fails
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (
    NEW.id,
    COALESCE(LEFT(NEW.raw_user_meta_data->>'username', 100), NULL)
  );
  RETURN NEW;
EXCEPTION WHEN unique_violation THEN
  RETURN NEW;
WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- DB-I2: Constrain importance to valid range
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'memories_importance_range'
  ) THEN
    ALTER TABLE memories ADD CONSTRAINT memories_importance_range CHECK (importance >= 0 AND importance <= 10);
  END IF;
END $$;

-- PERF-I2: Speed up speaker-filtered chat history queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_gang_speaker_created
ON chat_history(user_id, gang_id, speaker, created_at DESC);
