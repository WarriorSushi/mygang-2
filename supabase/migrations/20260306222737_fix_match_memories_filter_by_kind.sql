CREATE OR REPLACE FUNCTION public.match_memories(query_embedding vector, match_threshold double precision, match_count integer, p_user_id uuid)
 RETURNS TABLE(id uuid, content text, similarity double precision)
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    memories.id,
    memories.content,
    1 - (memories.embedding <=> query_embedding) AS similarity
  FROM memories
  WHERE memories.user_id = p_user_id
    AND memories.kind IN ('episodic', 'compacted')
    AND 1 - (memories.embedding <=> query_embedding) > match_threshold
  ORDER BY memories.embedding <=> query_embedding
  LIMIT match_count;
END;
$function$;;
