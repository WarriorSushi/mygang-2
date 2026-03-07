-- Drop existing permissive INSERT policy
DROP POLICY IF EXISTS "Users can insert analytics" ON analytics_events;

-- Create stricter policy requiring authentication
CREATE POLICY "Authenticated users can insert analytics events" ON analytics_events
  FOR INSERT WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND (user_id = (SELECT auth.uid())));;
