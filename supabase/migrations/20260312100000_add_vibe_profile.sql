-- Phase 05: Add vibe_profile column for onboarding quiz personalization
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS vibe_profile JSONB DEFAULT NULL;
