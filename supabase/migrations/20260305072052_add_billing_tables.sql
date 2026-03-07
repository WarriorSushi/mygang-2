
-- Add dodo_customer_id to profiles
alter table public.profiles add column if not exists dodo_customer_id text;

-- Update subscription_tier check constraint to include 'basic'
-- First drop existing constraint if any, then add new one
do $$
begin
  -- Try to drop any existing check constraint on subscription_tier
  begin
    alter table public.profiles drop constraint if exists profiles_subscription_tier_check;
  exception when others then null;
  end;
end $$;

-- Subscriptions table
create table if not exists public.subscriptions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  product_id text not null,
  plan text not null check (plan in ('basic', 'pro')),
  status text not null default 'pending'
    check (status in ('pending','active','on_hold','cancelled','expired')),
  current_period_end timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index if not exists idx_subscriptions_user on public.subscriptions(user_id);
create index if not exists idx_subscriptions_status on public.subscriptions(status);

-- Billing events audit trail
create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  dodo_event_id text,
  payload jsonb,
  created_at timestamptz default now()
);
create index if not exists idx_billing_events_user on public.billing_events(user_id);

-- RLS policies for subscriptions
alter table public.subscriptions enable row level security;

-- Users can read their own subscriptions
create policy "Users can read own subscriptions"
  on public.subscriptions for select
  using (auth.uid() = user_id);

-- Only service role can insert/update/delete subscriptions (webhooks)
create policy "Service role manages subscriptions"
  on public.subscriptions for all
  using (auth.role() = 'service_role');

-- RLS policies for billing_events
alter table public.billing_events enable row level security;

-- Users can read their own billing events
create policy "Users can read own billing events"
  on public.billing_events for select
  using (auth.uid() = user_id);

-- Only service role can insert billing events (webhooks)
create policy "Service role manages billing events"
  on public.billing_events for all
  using (auth.role() = 'service_role');
;
