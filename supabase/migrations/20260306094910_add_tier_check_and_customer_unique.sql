
-- 1. Add CHECK constraint on subscription_tier to enforce valid values
ALTER TABLE public.profiles
  ADD CONSTRAINT subscription_tier_valid
  CHECK (subscription_tier IN ('free', 'basic', 'pro'));

-- 2. Add UNIQUE constraint on dodo_customer_id to prevent duplicate customer records
CREATE UNIQUE INDEX IF NOT EXISTS profiles_dodo_customer_id_unique
  ON public.profiles (dodo_customer_id)
  WHERE dodo_customer_id IS NOT NULL;
;
