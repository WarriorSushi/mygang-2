REVOKE EXECUTE ON FUNCTION handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION protect_sensitive_profile_columns() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION increment_profile_counters(uuid, integer, numeric, text, integer, jsonb, jsonb, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION match_memories(vector, double precision, integer, uuid) FROM anon;;
