# Database Schema, Migrations & Data Architecture Audit Report

**Project**: MyGang by Antig
**Date**: 2026-02-16
**Auditor**: Claude Opus 4.6

---

## CRITICAL Issues

### R1 - `admin_runtime_settings` and `admin_audit_log` have RLS enabled but NO policies defined

**File**: `supabase/migrations/20260210224000_add_admin_runtime_controls.sql` (lines 21-22)

RLS is enabled on both tables, but zero SELECT/INSERT/UPDATE/DELETE policies are created. Current mitigation: All admin operations use `createAdminClient()` which bypasses RLS. The risk is fragile -- if someone adds a non-admin read path, it will fail silently.

**Recommendation**: Add explicit policies for service role or create a dedicated `admin` schema.

### DR1 - No cleanup strategy for any table

There is no retention policy, no scheduled cleanup job, and no archival strategy:
- **`chat_history`**: Grows unboundedly per user
- **`analytics_events`**: Every chat request logs a metric event, grows extremely fast
- **`memories`**: Grows per user with no cap
- **`admin_audit_log`**: Grows per admin action with no cap

**Recommendation**: Add `pg_cron` jobs for cleanup of analytics (90 days) and old chat history (180 days). Cap memories per user.

---

## HIGH Issues

### R2 - Guest chat history RLS policy allows any guest to see ALL guest messages

**File**: `supabase/migrations/20260203190126_initial_schema.sql` (lines 90-94)

The `is_guest = TRUE` clause means **any user can read ALL guest messages from ALL users**. Additionally, anyone can insert rows with `is_guest = TRUE` for any `user_id`.

**Recommendation**: Remove the `is_guest` bypass or scope it properly.

### R3 - No DELETE or UPDATE policy on `chat_history`

Only SELECT and INSERT policies exist. The `deleteAllMessages()` function uses the server client which respects RLS. Without a DELETE policy, this delete call returns zero affected rows -- **effectively a no-op**.

**Recommendation**: Add: `CREATE POLICY "Users can delete their chat history" ON chat_history FOR DELETE USING (user_id = auth.uid());`

### I1 - Missing index on `memories.embedding` for vector similarity search

**File**: `supabase/migrations/20260203190126_initial_schema.sql` (line 68)

The `match_memories` RPC performs cosine distance with no vector index. As memories grow, this does full sequential scans.

**Recommendation**: Add HNSW index: `CREATE INDEX memories_embedding_idx ON public.memories USING hnsw (embedding vector_cosine_ops);`

### M1 - Duplicate migration: `match_memories` function created twice

**Files**:
- `supabase/migrations/20260204000000_match_memories.sql`
- `supabase/migrations/20260204100000_add_match_memories.sql`

Nearly identical. Both use `CREATE OR REPLACE FUNCTION`. Confusing and should be consolidated.

### Q1 - Race condition in daily message count increment

**File**: `src/app/api/chat/route.ts` (lines 714-722, 1182)

The daily count check and increment is read-modify-write across an LLM call (2-15 seconds). Concurrent requests can read the same count, both pass the limit check, and both increment from the same base value.

**Recommendation**: Use atomic SQL increment via RPC.

### Q2 - `storeMemory` duplicate check is racy

**File**: `src/lib/ai/memory.ts` (lines 66-82)

Two concurrent requests with the same content could both pass the duplicate check and insert.

**Recommendation**: Add a unique partial index or use `INSERT ... ON CONFLICT DO NOTHING`.

### C1 - Profile update race condition in chat route

**File**: `src/app/api/chat/route.ts` (line 1189)

Reads full profile state at start, computes updates over 2-15 seconds (LLM call), then writes the entire updated row. Last writer wins, losing intermediate updates. Affects: `daily_msg_count`, `abuse_score`, `summary_turns`, `relationship_state`, `user_profile`, `session_summary`.

**Recommendation**: Use atomic increments for numeric fields and `jsonb_set` for JSONB fields.

### B1 - Admin client created per-call, not cached

**File**: `src/lib/supabase/admin.ts` (lines 3-13)

Every call creates a new `SupabaseClient` instance, creating new HTTP connections each time.

**Recommendation**: Cache as a module-level singleton.

---

## MEDIUM Issues

### S1 - Overloaded `profiles` table

The `profiles` table has grown to include user settings, memory state, relationship state, session summaries, abuse scores, and chat preferences. A single UPDATE touches an increasingly wide row.

**Recommendation**: Split into `user_settings` and `user_state` tables.

### S4 - No `updated_at` trigger on `profiles`

The `updated_at` column exists but there is no trigger to automatically set it. Column is always stuck at creation time.

### R4 - `characters` table has no RLS enabled

Any authenticated user with the anon key could potentially INSERT, UPDATE, or DELETE characters.

**Recommendation**: Enable RLS and add a SELECT-only public policy.

### D1 - `daily_msg_count` has no upper bound constraint

No CHECK constraint. A bug could set this to negative or extremely high values.

### D2 - `abuse_score` can grow unbounded

No upper cap. The block threshold is 12, but the score could grow to thousands.

### F1 - `gang_members.character_id` has no ON DELETE behavior

Default `NO ACTION`. If a character is deleted, gang_members rows cause the delete to fail.

### F2 - `chat_history.speaker` is not a foreign key

No foreign key or CHECK constraint. Invalid speaker values can be inserted.

### Q3 - Gang member replacement is not atomic

DELETE then INSERT -- if operation fails between steps, user loses their gang.

**Recommendation**: Wrap in a database function (RPC) for single transaction.

### Q4 - `getMemories()` fetches ALL memories without pagination

No `.limit()` clause. Power users with hundreds of memories cause unbounded queries.

### C2 - Global low-cost override cache is process-local

Module-level variable, per-process in serverless. The 20-second cache may not be as effective.

### C3 - `cachedDbPromptBlocks` never invalidates

Once loaded, never invalidated. Changes require server restart.

---

## LOW Issues

### S2 - `characters.id` is TEXT with no format constraint
### S3 - `gang_members.relationship_score` is defined but never used
### D3 - `gang_vibe_score` column never used
### D4 - `chat_history.content` has no length constraint
### I3 - Missing index on `memories.kind`
### R5 - Overlapping policies on `gangs` table (redundant SELECT + ALL)
### R6 - Analytics SELECT policy prevents admin dashboard queries
### I4 - Analytics indexes could be composite
### M3 - Seed data embedded in migration file
### B3 - Non-null assertions on env vars in client

---

## Summary Table

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 8 |
| MEDIUM | 11 |
| LOW | 10 |

## Priority Recommendations

1. **Add a DELETE policy on `chat_history`** -- `deleteAllMessages()` is currently broken.
2. **Fix guest chat history RLS bypass** -- data leaks across users.
3. **Add vector index on `memories.embedding`** -- performance degrades as data grows.
4. **Implement atomic profile updates** -- use SQL-level increments or RPC.
5. **Implement data retention** -- cleanup for `analytics_events` and old `chat_history`.
