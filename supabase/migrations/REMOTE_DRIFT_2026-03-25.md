# Remote Drift Note — March 25, 2026

This note records the linked Supabase drift discovered on March 25, 2026.

## Facts captured

- `supabase migration list` showed the linked remote database had 14 applied versions that do not exist in this repo.
- The remote-only versions were:
  - `20260316224522`
  - `20260317170547`
  - `20260317170549`
  - `20260317170551`
  - `20260317170552`
  - `20260317195424`
  - `20260317195426`
  - `20260317195429`
  - `20260317195431`
  - `20260317195433`
  - `20260317195435`
  - `20260317195437`
- `20260317195505`
- `20260317195507`
- The checked-in `src/lib/database.types.ts` matched `supabase gen types typescript --linked --schema public` on March 25, 2026.
- That means the repo was not behind in app-visible table/column types at the time this note was written. The missing history is likely policy/function/grant/index/cleanup work not visible in generated TypeScript types.
- After Docker Desktop was brought up, `supabase db diff --linked --schema public -f remote_drift_reconciliation` generated `supabase/migrations/20260324220158_remote_drift_reconciliation.sql`.
- With `20260324220158_remote_drift_reconciliation.sql` present, `supabase db diff --linked --schema public` returned `No schema changes found`.
- The reconciliation migration version `20260324220158` was then marked `applied` on the linked remote via `supabase migration repair --status applied 20260324220158`.
- The 14 March 16-17, 2026 remote-only versions remain remote-only and are intentionally acknowledged as historical drift. They were not marked reverted and were not backfilled as fake local history.

## Safety policy

- Do not run `supabase db push` against shared environments unless `pnpm run guard:supabase-authority` is green.
- Do not use `supabase migration repair --status reverted ...` on the remote project unless the exact remote-only SQL has been recovered and verified.
- Do not backfill fake historical migration files for the March 16-17, 2026 timestamps.

## Recovery result

1. A Docker-enabled run captured the behavioral delta from the linked remote.
2. The forward-only recovery point is `20260324220158_remote_drift_reconciliation.sql`.
3. The repo now replays cleanly to the linked remote schema, and `pnpm run guard:supabase-linked-diff` is the proof point for that claim.
4. `pnpm run guard:supabase-migration-parity` now accepts only this one known historical drift set and still fails on any unexpected remote-only or local-only versions.
5. The recovery remains valid only while:
   - the types still match
   - parity reports only the acknowledged March 16-17, 2026 drift
   - the linked diff is empty

## Canonical source of truth

Before `20260324220158_remote_drift_reconciliation.sql` existed, the linked remote database was the operational source of truth for DB behavior.

After reconciliation, `20260324220158_remote_drift_reconciliation.sql` is the canonical repo recovery point. Git is authoritative again for forward changes, while the 14 March 16-17, 2026 remote-only versions remain an acknowledged historical exception.
