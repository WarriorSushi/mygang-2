CREATE TABLE IF NOT EXISTS public.analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT NOT NULL,
  event TEXT NOT NULL,
  value INTEGER,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert analytics" ON public.analytics_events
  FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their analytics" ON public.analytics_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS analytics_events_event_idx ON public.analytics_events (event);
CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON public.analytics_events (created_at);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON public.analytics_events (session_id);
