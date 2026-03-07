-- 1. Fix guest INSERT policy on chat_history (was allowing any unauthenticated insert)
DROP POLICY IF EXISTS "Users can insert their chat history" ON public.chat_history;
CREATE POLICY "Users can insert their chat history" ON public.chat_history
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- 2. Add composite index (user_id, kind, created_at) on memories
CREATE INDEX IF NOT EXISTS memories_user_kind_created_idx
  ON public.memories (user_id, kind, created_at DESC);

-- 4. Replace admin table policies with explicit deny-all (service-role only access)
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.admin_runtime_settings;
DROP POLICY IF EXISTS "Admin only via service role" ON public.admin_runtime_settings;
CREATE POLICY "Admin only via service role" ON public.admin_runtime_settings
  FOR ALL USING (false);

DROP POLICY IF EXISTS "Deny all access to regular users" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Admin only via service role" ON public.admin_audit_log;
CREATE POLICY "Admin only via service role" ON public.admin_audit_log
  FOR ALL USING (false);

-- 5. Add INSERT policy on profiles (currently only SELECT and UPDATE exist)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());
