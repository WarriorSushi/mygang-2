-- 1. Add CHECK constraint on subscription_tier to enforce valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'subscription_tier_valid'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT subscription_tier_valid
      CHECK (subscription_tier IN ('free', 'basic', 'pro'));
  END IF;
END
$$;

-- 2. Add UNIQUE constraint on dodo_customer_id to prevent duplicate customer records
CREATE UNIQUE INDEX IF NOT EXISTS profiles_dodo_customer_id_unique
  ON public.profiles (dodo_customer_id)
  WHERE dodo_customer_id IS NOT NULL;
