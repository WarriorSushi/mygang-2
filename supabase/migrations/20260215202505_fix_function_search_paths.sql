-- Fix mutable search_path warnings on all functions

ALTER FUNCTION public.increment_profile_counters(UUID, INT, NUMERIC, TEXT, INT, JSONB, JSONB)
  SET search_path = public;

ALTER FUNCTION public.match_memories(vector, float, int, uuid)
  SET search_path = public;

ALTER FUNCTION public.handle_new_user()
  SET search_path = public;

ALTER FUNCTION public.handle_updated_at()
  SET search_path = public;;
