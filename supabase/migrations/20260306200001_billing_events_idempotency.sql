-- Add unique constraint on dodo_event_id to prevent duplicate webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS billing_events_dodo_event_id_unique
  ON public.billing_events (dodo_event_id)
  WHERE dodo_event_id IS NOT NULL;
