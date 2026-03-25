-- Track which characters were added at which subscription tier
create table if not exists squad_tier_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  character_id text not null,
  added_at_tier text not null check (added_at_tier in ('basic', 'pro')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  unique (user_id, character_id)
);

alter table squad_tier_members enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'squad_tier_members'
      AND policyname = 'Users can read own squad_tier_members'
  ) THEN
    CREATE POLICY "Users can read own squad_tier_members"
      ON squad_tier_members FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'squad_tier_members'
      AND policyname = 'Users can insert own squad_tier_members'
  ) THEN
    CREATE POLICY "Users can insert own squad_tier_members"
      ON squad_tier_members FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'squad_tier_members'
      AND policyname = 'Users can update own squad_tier_members'
  ) THEN
    CREATE POLICY "Users can update own squad_tier_members"
      ON squad_tier_members FOR UPDATE
      USING (auth.uid() = user_id);
  END IF;
END
$$;

create index if not exists idx_squad_tier_members_user on squad_tier_members(user_id);

-- Profile flags for tier transition state
alter table profiles add column if not exists pending_squad_downgrade boolean default false;
alter table profiles add column if not exists restored_members_pending text[] default '{}';
