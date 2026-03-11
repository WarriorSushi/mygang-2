-- =============================================================================
-- Migration: add_expires_at_to_memories
-- Date: 2026-03-11
-- Description: Add temporal memory support. Expired memories are filtered at
--              retrieval time, not hard-deleted.
-- =============================================================================

SET search_path TO public, extensions;

-- -----------------------------------------------------------------------------
-- Add expires_at column for temporal memories (mood, plans, schedules)
-- NULL means permanent (stable facts like name, job, preferences)
-- -----------------------------------------------------------------------------

ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS memories_expires_at_idx
  ON public.memories (user_id, expires_at)
  WHERE expires_at IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Rebuild match_memories to filter out expired temporal memories
-- Keeps existing return shape, auth guard, and kind filter intact
-- -----------------------------------------------------------------------------

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
    AND (memories.expires_at IS NULL OR memories.expires_at > NOW())
  ORDER BY memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.match_memories(vector, double precision, integer, uuid) FROM anon;
