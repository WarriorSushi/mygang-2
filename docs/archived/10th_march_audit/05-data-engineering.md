# Data Engineering & Schema Review

## Summary

Schema is well-structured for an early-stage product. CASCADE rules are comprehensive, webhook idempotency is solid, and the billing event pipeline is atomic. Key real issues: `relationship_state` concurrent updates clobber each other (last-writer-wins), `analytics_events` has no retention policy and will become the largest table, and `persistUserJourney` uses a non-atomic delete-then-insert pattern.

---

## Current Bugs

### [HIGH] `relationship_state` Race Condition (Last-Writer-Wins)

**Table:** `profiles.relationship_state`, `increment_profile_counters` RPC

**Issue:** `COALESCE(p_relationship_state, relationship_state)` does full JSON replacement. Two rapid messages = second `increment_profile_counters` call overwrites the first's relationship deltas entirely. The app does `Math.max(0, Math.min(100, n))` but concurrent calls replace the whole JSON blob.

**Impact:** Real data corruption. Rapid messaging loses relationship affinity/trust changes from the first message.

**Fix:** Switch to `jsonb_set` or `||` merge inside the RPC so concurrent calls merge deltas instead of overwriting.

---

### [MEDIUM] Dispute Handler Queries Wrong User (Cross-confirmed with Security Review)

**Table:** `billing_events`
**File:** `src/app/api/webhook/dodo-payments/route.ts` lines 399-405

**Issue:** `onDisputeOpened` does `SELECT user_id FROM billing_events WHERE event_type = 'payment.succeeded' AND user_id IS NOT NULL LIMIT 1` — no filter on the disputed payment. Returns the first-ever paying user, not the disputer.

**Fix:** Match by `payment_id` from the dispute payload. Add GIN index on `billing_events.payload` for JSONB lookups.

*(This is the same bug as Security Review C1, independently confirmed from a query pattern perspective.)*

---

### [MEDIUM] `persistUserJourney` Delete-Then-Insert is Not Atomic

**File:** `src/lib/supabase/client-journey.ts` lines 108-114

**Issue:** `DELETE ... WHERE gang_id = X` followed by `INSERT`. If insert fails (network error, constraint violation), the user's gang is empty. `saveGang` in `auth/actions.ts` does this correctly with upsert-then-delete-stale.

**Impact:** Failed insert after successful delete = empty gang, user must re-onboard.

**Fix:** Use same upsert-then-delete-stale pattern as `saveGang`.

---

### [MEDIUM] `subscriptions` Table Has No Unique Constraint on Active Subscriptions

**Table:** `subscriptions`

**Issue:** No unique constraint preventing multiple active subscriptions per user. The app trusts `profiles.subscription_tier`, so this is latent. But creates data integrity issues for billing reconciliation.

**Fix:** `CREATE UNIQUE INDEX idx_subscriptions_user_active ON subscriptions(user_id) WHERE status IN ('active', 'cancelled_pending')`.

---

### [MEDIUM] `daily_msg_count` / `last_msg_reset` is Vestigial

**Table:** `profiles`, `increment_profile_counters` RPC

**Issue:** Rate limiting uses Redis now. `increment_profile_counters` still increments `daily_msg_count` and does 24h resets, taking a `FOR UPDATE` lock on every chat request for a counter nothing reads.

**Fix:** Remove `p_daily_msg_increment` and reset logic from the RPC. Remove columns from chat route profile SELECT.

---

## Scale Planning (Not Current Bugs)

### [FUTURE] `analytics_events` Unbounded Growth

**Issue:** Events inserted on every page interaction + every chat request. No TTL, no partition, no archival. `ON DELETE SET NULL` keeps orphaned rows forever. Will become the largest table within a month at scale.

**Recommendation:** Add pg_cron retention job (30 days). Consider sampling `chat_route_metrics`. Change FK to `ON DELETE CASCADE`.

---

### [FUTURE] `chat_history` Growth at Scale

**Issue:** Every user + AI message inserted. No partitioning. Composite index helps but table will dominate storage at 50M+ rows.

**Recommendation:** When approaching millions of rows: add `PARTITION BY RANGE (created_at)`, implement retention for free tier, consider BRIN index on `created_at`.

---

### [FUTURE] Memory Compaction Race Window

**Issue:** Between `kind='compacting'` claim and archive, LLM call can take 10+ seconds. Stuck rows are invisible to retrieval. Recovery only runs at start of next compaction attempt.

**Recommendation:** Add timestamp-based auto-recovery (reset `compacting` rows older than 5 minutes).

---

## Informational (Already Addressed)

- **Vector index on `memories.embedding`** — HNSW indexes already exist in migrations `20260215195810` and `20260304212738`. No action needed.
- **`memories.kind` CHECK constraint** — Already exists from migration `20260306222727`. Enum migration is optional cleanup.
- **Composite index `(user_id, kind, created_at)` on memories** — Recommended for query optimization. Not a bug.
- **`profiles.subscription_tier` vs `subscriptions.plan` divergence** — Treat `subscriptions.plan` as immutable (what was purchased), `profiles.subscription_tier` as current effective tier. Document the distinction.

---

## What's Done Well

1. **CASCADE rules** — `profiles → gangs → gang_members → chat_history` all cascade. `billing_events` uses `ON DELETE SET NULL` for audit trail.
2. **Atomic profile counter updates** — `SELECT ... FOR UPDATE` prevents races
3. **Idempotent webhook processing** — `dodo_event_id` unique index + insert-on-conflict
4. **Sensitive column protection trigger** — prevents user-role clients from modifying `subscription_tier`, `abuse_score`, etc.
5. **Batched deletion** — 500-row batches with select-then-delete for large tables
6. **Memory compaction with optimistic locking** — `kind='compacting'` as distributed lock
7. **Migration safety** — `IF NOT EXISTS` guards, exception handling in triggers
8. **`updated_at` triggers** — on all mutable tables
