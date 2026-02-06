ALTER TABLE public.characters ADD COLUMN IF NOT EXISTS prompt_block TEXT;

UPDATE public.characters
SET prompt_block = CONCAT(
  '- ID: "', id, '", ',
  'Name: "', name, '", ',
  'Archetype: "', archetype, '", ',
  'Voice: "', voice_description, '", ',
  'Style: "', sample_line, '"'
)
WHERE prompt_block IS NULL;
