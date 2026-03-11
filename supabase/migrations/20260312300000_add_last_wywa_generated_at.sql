-- Phase 06C: Track last WYWA generation time per user for cooldown/idempotency.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_wywa_generated_at TIMESTAMPTZ DEFAULT NULL;
