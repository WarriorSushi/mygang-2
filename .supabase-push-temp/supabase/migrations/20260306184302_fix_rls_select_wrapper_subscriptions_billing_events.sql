-- subscriptions
DROP POLICY IF EXISTS "Users can read own subscriptions" ON subscriptions;
CREATE POLICY "Users can read own subscriptions" ON subscriptions
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages subscriptions" ON subscriptions;
CREATE POLICY "Service role manages subscriptions" ON subscriptions
  FOR ALL USING ((SELECT auth.role()) = 'service_role');

-- billing_events
DROP POLICY IF EXISTS "Users can read own billing events" ON billing_events;
CREATE POLICY "Users can read own billing events" ON billing_events
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role manages billing events" ON billing_events;
CREATE POLICY "Service role manages billing events" ON billing_events
  FOR ALL USING ((SELECT auth.role()) = 'service_role');;
