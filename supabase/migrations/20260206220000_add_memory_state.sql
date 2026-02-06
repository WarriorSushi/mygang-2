-- Add memory + relationship state + settings fields
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_profile JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS relationship_state JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS session_summary TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS summary_turns INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS abuse_score INTEGER DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS theme TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS chat_mode TEXT DEFAULT 'ecosystem';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_squad TEXT[];

-- Extend memories table for low-cost memory usage
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS kind TEXT DEFAULT 'episodic';
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS importance INTEGER DEFAULT 1;
ALTER TABLE public.memories ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
