
-- =============================================================================
-- 1. Add missing foreign key indexes for query performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON public.analytics_events (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_gang_id ON public.chat_history (gang_id);
CREATE INDEX IF NOT EXISTS idx_gang_members_character_id ON public.gang_members (character_id);

-- =============================================================================
-- 2. Remove duplicate gang_members SELECT policy (ALL policy already covers it)
-- =============================================================================
DROP POLICY IF EXISTS "Users can view their gang members" ON public.gang_members;

-- =============================================================================
-- 3. Optimize all RLS policies to use (select auth.uid()) instead of auth.uid()
--    This evaluates once per query instead of per row.
-- =============================================================================

-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()));

-- gangs
DROP POLICY IF EXISTS "Users can manage their own gang" ON public.gangs;
CREATE POLICY "Users can manage their own gang" ON public.gangs
  FOR ALL USING (user_id = (select auth.uid()));

-- gang_members (keep only ALL policy, now optimized)
DROP POLICY IF EXISTS "Users can manage their gang members" ON public.gang_members;
CREATE POLICY "Users can manage their gang members" ON public.gang_members
  FOR ALL
  USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = (select auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = (select auth.uid())));

-- chat_history
DROP POLICY IF EXISTS "Users can view their chat history" ON public.chat_history;
CREATE POLICY "Users can view their chat history" ON public.chat_history
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their chat history" ON public.chat_history;
CREATE POLICY "Users can insert their chat history" ON public.chat_history
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their chat history" ON public.chat_history;
CREATE POLICY "Users can update their chat history" ON public.chat_history
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their chat history" ON public.chat_history;
CREATE POLICY "Users can delete their chat history" ON public.chat_history
  FOR DELETE USING (user_id = (select auth.uid()));

-- memories
DROP POLICY IF EXISTS "Users can managed their memories" ON public.memories;
CREATE POLICY "Users can manage their memories" ON public.memories
  FOR ALL USING (user_id = (select auth.uid()));

-- analytics_events
DROP POLICY IF EXISTS "Users can insert analytics" ON public.analytics_events;
CREATE POLICY "Users can insert analytics" ON public.analytics_events
  FOR INSERT WITH CHECK (((select auth.uid()) = user_id) OR (user_id IS NULL));

DROP POLICY IF EXISTS "Users can view their analytics" ON public.analytics_events;
CREATE POLICY "Users can view their analytics" ON public.analytics_events
  FOR SELECT USING ((select auth.uid()) = user_id);
;
