-- Item 34: Fix INSERT policies to use (select auth.uid()) instead of bare auth.uid()
-- This prevents re-evaluation per row, improving performance and security.

-- Fix profiles insert policy
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT WITH CHECK (id = (select auth.uid()));

-- Fix chat_history insert policy
DROP POLICY IF EXISTS "Users can insert their chat history" ON chat_history;
CREATE POLICY "Users can insert their chat history" ON chat_history
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- Item 35: Remove redundant service_role ALL policies on billing tables.
-- service_role bypasses RLS by default, so these permissive ALL policies are
-- unnecessary and create duplicate permissive SELECT paths with the user-facing
-- SELECT policies.

DROP POLICY IF EXISTS "Service role manages billing events" ON billing_events;
DROP POLICY IF EXISTS "Service role manages subscriptions" ON subscriptions;

-- Item 54: Recreate handle_updated_at with SET search_path = '' (empty)
-- Currently set to 'public', which is less secure. Empty search_path prevents
-- schema injection attacks.

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = '';
