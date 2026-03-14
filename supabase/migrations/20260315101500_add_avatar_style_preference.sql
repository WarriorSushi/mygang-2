ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_style_preference TEXT DEFAULT 'robots';

UPDATE public.profiles
SET avatar_style_preference = 'robots'
WHERE avatar_style_preference IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN avatar_style_preference SET DEFAULT 'robots';

ALTER TABLE public.profiles
  ALTER COLUMN avatar_style_preference SET NOT NULL;

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_avatar_style_preference_check
    CHECK (avatar_style_preference IN ('robots', 'human', 'retro'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
