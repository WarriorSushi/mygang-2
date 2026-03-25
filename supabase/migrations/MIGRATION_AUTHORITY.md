# Migration Authority

This directory is forward-only. Do not rename, delete, or rewrite historical migration files in place, even when later files repeat the same intent more cleanly.

## Operator rule

Before relying on any audit-era migration pair, verify the exact applied timestamps in the target environment's migration history table. Different environments may have landed different timestamps from the same remediation wave.

## Current drift note

On March 25, 2026, the linked remote project was found to have remote-only applied versions from March 16-17, 2026 that are not present in this repo. See `REMOTE_DRIFT_2026-03-25.md` in this directory before attempting `supabase db push`, `supabase db pull`, or `supabase migration repair` on the shared project.

## Canonical recovery point

`20260324220158_remote_drift_reconciliation.sql` is the forward-only recovery point that makes a fresh replay of this repo converge to the linked remote schema. The March 16-17, 2026 remote-only versions remain acknowledged history and must not be rewritten.

## Reference pairs

Treat the later file in each pair below as the cleaner reference copy when reading history or preparing follow-up work. The earlier file remains historical and must stay in the repo.

When a later reference copy collides with an earlier already-applied copy during fresh replay, only replay-safety guards may be added to the later file. Do not change intent, rename timestamps, or delete history.

| Earlier file | Later file | Note |
| --- | --- | --- |
| `20260304212729_update_increment_profile_counters.sql` | `20260305000001_update_increment_profile_counters.sql` | Same remediation area, later file is the clearer audit-restated copy. |
| `20260304212738_audit_fixes.sql` | `20260305000002_audit_fixes.sql` | Same audit-fix bundle, later file is the reference copy for human review. |
| `20260306000001_add_tier_check_and_customer_unique.sql` | `20260306094910_add_tier_check_and_customer_unique.sql` | Same billing constraint intent, later file is the cleaner reference copy. |
| `20260306161551_guest_cleanup_and_rls.sql` | `20260306200002_guest_cleanup_and_rls.sql` | Same guest-cleanup / RLS intent, later file is the reference copy. |
| `20260310090045_audit_rls_and_functions.sql` | `20260310120000_audit_rls_and_functions.sql` | Near-duplicate audit remediation pair; later file is the cleaner reference copy. |
| `20260310155059_audit_phase2_fixes.sql` | `20260310200000_audit_phase2_fixes.sql` | Near-duplicate phase-2 audit remediation pair; later file is the cleaner reference copy. |

## Future changes

- Ship new schema changes as new migrations only.
- Use this note to understand intent overlap; do not "clean up" by deleting old SQL files.
- Keep `src/lib/database.types.ts` and the character catalog guard current whenever schema or catalog rows change.
