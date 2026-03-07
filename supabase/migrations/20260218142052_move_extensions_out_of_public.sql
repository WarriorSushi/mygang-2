
-- Move vector extension from public to extensions schema
ALTER EXTENSION vector SET SCHEMA extensions;

-- Move pg_trgm extension from public to extensions schema
ALTER EXTENSION pg_trgm SET SCHEMA extensions;
;
