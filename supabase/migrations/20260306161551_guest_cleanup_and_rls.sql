
-- 1. Drop is_guest column from chat_history (old guest flow remnant)
ALTER TABLE public.chat_history DROP COLUMN IF EXISTS is_guest;

-- 2. Wrap RLS policies to use (select auth.uid()) for per-query eval (I8)
-- profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = (select auth.uid()));

-- gangs
DROP POLICY IF EXISTS "Users can view their own gang" ON public.gangs;
CREATE POLICY "Users can view their own gang" ON public.gangs
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can manage their own gang" ON public.gangs;
CREATE POLICY "Users can manage their own gang" ON public.gangs
  FOR ALL USING (user_id = (select auth.uid()));

-- gang_members
DROP POLICY IF EXISTS "Users can view their gang members" ON public.gang_members;
CREATE POLICY "Users can view their gang members" ON public.gang_members
  FOR SELECT USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = (select auth.uid())));

DROP POLICY IF EXISTS "Users can manage their gang members" ON public.gang_members;
CREATE POLICY "Users can manage their gang members" ON public.gang_members
  FOR ALL USING (EXISTS (SELECT 1 FROM gangs WHERE gangs.id = gang_members.gang_id AND gangs.user_id = (select auth.uid())));

-- chat_history INSERT
DROP POLICY IF EXISTS "Users can insert their chat history" ON public.chat_history;
CREATE POLICY "Users can insert their chat history" ON public.chat_history
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

-- memories
DROP POLICY IF EXISTS "Users can managed their memories" ON public.memories;
DROP POLICY IF EXISTS "Users can manage their memories" ON public.memories;
CREATE POLICY "Users can manage their memories" ON public.memories
  FOR ALL USING (user_id = (select auth.uid()));

-- squad_tier_members: add DELETE policy (M9) + update existing to use (select auth.uid())
DROP POLICY IF EXISTS "Users can read own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can read own squad_tier_members" ON public.squad_tier_members
  FOR SELECT USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can insert own squad_tier_members" ON public.squad_tier_members
  FOR INSERT WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can update own squad_tier_members" ON public.squad_tier_members
  FOR UPDATE USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own squad_tier_members" ON public.squad_tier_members;
CREATE POLICY "Users can delete own squad_tier_members" ON public.squad_tier_members
  FOR DELETE USING (user_id = (select auth.uid()));
;
