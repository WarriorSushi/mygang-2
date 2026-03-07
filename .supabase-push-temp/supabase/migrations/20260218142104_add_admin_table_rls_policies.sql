
-- admin_runtime_settings: allow authenticated reads (the app reads global settings), deny all writes via RLS
CREATE POLICY "Allow authenticated read access"
  ON public.admin_runtime_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- admin_audit_log: only service_role should write; deny all access to regular users
CREATE POLICY "Deny all access to regular users"
  ON public.admin_audit_log
  FOR ALL
  TO authenticated
  USING (false);
;
