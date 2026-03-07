-- =============================================================================
-- Migration: audit_v3_db_fixes
-- Date: 2026-03-07
-- Description: Combined audit fixes for DB schema, indexes, and function improvements
-- =============================================================================

-- Ensure vector type is visible (extension lives in extensions schema)
SET search_path TO public, extensions;

-- -----------------------------------------------------------------------------
-- D-C3: Add ON DELETE CASCADE to gang_members.character_id and
--        squad_tier_members.character_id
-- -----------------------------------------------------------------------------

ALTER TABLE public.gang_members DROP CONSTRAINT IF EXISTS gang_members_character_id_fkey;
ALTER TABLE public.gang_members ADD CONSTRAINT gang_members_character_id_fkey
  FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;

ALTER TABLE public.squad_tier_members DROP CONSTRAINT IF EXISTS squad_tier_members_character_id_fkey;
ALTER TABLE public.squad_tier_members ADD CONSTRAINT squad_tier_members_character_id_fkey
  FOREIGN KEY (character_id) REFERENCES public.characters(id) ON DELETE CASCADE;

-- -----------------------------------------------------------------------------
-- D-I2 & D-I3: Set NOT NULL on created_at for subscriptions and profiles
-- (Other tables were handled in 20260306222721_set_not_null_on_created_at_columns)
-- -----------------------------------------------------------------------------

ALTER TABLE public.subscriptions ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN created_at SET NOT NULL;

-- -----------------------------------------------------------------------------
-- D-I6: Add updated_at column and triggers to mutable tables that lack them
-- (subscriptions and admin_runtime_settings already have triggers from
--  20260306184306_add_updated_at_triggers)
-- -----------------------------------------------------------------------------

ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.gang_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.squad_tier_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DROP TRIGGER IF EXISTS set_memories_updated_at ON public.memories;
CREATE TRIGGER set_memories_updated_at
  BEFORE UPDATE ON public.memories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_gang_members_updated_at ON public.gang_members;
CREATE TRIGGER set_gang_members_updated_at
  BEFORE UPDATE ON public.gang_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_squad_tier_members_updated_at ON public.squad_tier_members;
CREATE TRIGGER set_squad_tier_members_updated_at
  BEFORE UPDATE ON public.squad_tier_members
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- -----------------------------------------------------------------------------
-- D-I7: Add index on billing_events.event_type for faster lookups
-- -----------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_billing_events_event_type ON public.billing_events(event_type);

-- -----------------------------------------------------------------------------
-- M-C1 + S-I5: Rebuild match_memories to return additional columns
--              (importance, created_at, last_used_at, category)
--              and add auth.uid() guard with service_role bypass
-- -----------------------------------------------------------------------------

-- Must drop first because CREATE OR REPLACE cannot change return type
DROP FUNCTION IF EXISTS public.match_memories(vector, double precision, integer, uuid);

CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector,
  match_threshold double precision,
  match_count integer,
  p_user_id uuid
)
RETURNS TABLE(
  id uuid,
  content text,
  similarity double precision,
  importance integer,
  created_at timestamptz,
  last_used_at timestamptz,
  category text
)
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
BEGIN
  -- S-I5: auth.uid() guard with service_role / supabase_admin bypass
  _role := coalesce(current_setting('request.jwt.claim.role', true), '');
  IF _role NOT IN ('service_role', 'supabase_admin') THEN
    IF p_user_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Unauthorized: user mismatch';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    memories.id,
    memories.content,
    1 - (memories.embedding <=> query_embedding) AS similarity,
    memories.importance,
    memories.created_at,
    memories.last_used_at,
    memories.category
  FROM memories
  WHERE memories.user_id = p_user_id
    AND memories.kind IN ('episodic', 'compacted')
    AND 1 - (memories.embedding <=> query_embedding) > match_threshold
  ORDER BY memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

-- Re-revoke anon access after function replacement (matches existing policy)
REVOKE EXECUTE ON FUNCTION public.match_memories(vector, double precision, integer, uuid) FROM anon;
