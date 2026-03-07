-- D-I5: Allow service_role to call increment_profile_counters
-- The auth.uid() guard blocks service_role calls (auth.uid() is null for service_role).
-- Add bypass for service_role / supabase_admin like match_memories has.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION increment_profile_counters(
  p_user_id UUID,
  p_daily_msg_increment INT DEFAULT 0,
  p_abuse_score_increment NUMERIC DEFAULT 0,
  p_session_summary TEXT DEFAULT NULL,
  p_summary_turns INT DEFAULT NULL,
  p_user_profile JSONB DEFAULT NULL,
  p_relationship_state JSONB DEFAULT NULL,
  p_last_active_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(daily_msg_count INT, last_msg_reset TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_daily_msg_count INT;
  v_last_msg_reset TIMESTAMPTZ;
  _role text;
BEGIN
  -- Guard: only allow users to update their own profile, with service_role bypass
  _role := coalesce(current_setting('request.jwt.claim.role', true), '');
  IF _role NOT IN ('service_role', 'supabase_admin') THEN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Access denied: cannot update another user''s counters';
    END IF;
  END IF;

  SELECT p.daily_msg_count, p.last_msg_reset
    INTO v_daily_msg_count, v_last_msg_reset
    FROM profiles p
   WHERE p.id = p_user_id
     FOR UPDATE;

  IF v_last_msg_reset IS NULL OR (now() - v_last_msg_reset) > interval '24 hours' THEN
    v_daily_msg_count := 0;
    v_last_msg_reset := now();
  END IF;

  v_daily_msg_count := LEAST(10000, GREATEST(0, COALESCE(v_daily_msg_count, 0) + p_daily_msg_increment));

  UPDATE profiles SET
    daily_msg_count = v_daily_msg_count,
    last_msg_reset = v_last_msg_reset,
    abuse_score = LEAST(1000, GREATEST(0, COALESCE(abuse_score, 0) + p_abuse_score_increment)),
    session_summary = COALESCE(p_session_summary, session_summary),
    summary_turns = COALESCE(p_summary_turns, summary_turns),
    user_profile = COALESCE(p_user_profile, user_profile),
    relationship_state = COALESCE(p_relationship_state, relationship_state),
    last_active_at = COALESCE(p_last_active_at, last_active_at)
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_daily_msg_count, v_last_msg_reset;
END;
$$;
