# MyGang: Audit-Based Improvement Plan

**Author:** Irfan
**Date:** 6th March 2026
**Project:** MyGang — AI group chat with character friends
**Stack:** Next.js 16 + Supabase + Zustand + DodoPayments + OpenRouter

---

## Context: Old Flow vs New Flow

The onboarding was recently changed from a guest-first deferred-auth flow to an auth-first flow (Google OAuth upfront). The old flow allowed users to onboard without signing up — username capture, character selection, and chat all happened before auth. Signup was triggered on first message send.

The new flow requires Google Auth immediately from the landing page CTA, then proceeds to onboarding (name, character selection) and chat.

**Problem:** The old guest flow was not fully cleaned up. Several audit findings are direct consequences of this, and other pre-existing issues compound the risk.

### What Was Already Cleaned Up
- INSERT policy on chat_history no longer allows `is_guest = TRUE`
- No `isGuest` flag in Zustand store
- No signup modal or deferred-auth logic in components
- `post-auth` page handles local-to-remote data merge
- Onboarding page has client-side auth guard

### What Was NOT Cleaned Up
- `is_guest` column still exists in chat_history table
- SELECT RLS policy still has `OR is_guest = TRUE` (security hole — C4)
- No server-side middleware to block unauthenticated access (C6)
- Orphaned guest rows may exist in chat_history from users who never signed up
- `database.types.ts` still references `is_guest`

---

## Excluded from This Plan

- **Streamed/streamable responses** — not wanted
- **Web push notifications** — not wanted
- **Voice messages** — deferred to future

---

## Phase 1: Critical Security & Billing (Ship-Blocking)

These MUST be fixed before anything else. They represent real vulnerabilities and broken functionality.

### 1.1 Auth Bypass in /activate (C1 + C2)

**File:** `src/app/api/checkout/activate/route.ts:27-39`
**Problem:** Ownership check is skipped when `subCustomerId` is falsy. Users with no `dodo_customer_id` also bypass it. Cancelled/expired subscriptions still grant tier upgrades.
**Fix:**
- Reject if `!subCustomerId` (deny-by-default)
- Validate `subscription.status` is `active` or `trialing` before proceeding
- Return 403 for ownership mismatches instead of silently continuing

### 1.2 increment_profile_counters RPC Guard (C3)

**File:** Migrations (SECURITY DEFINER function)
**Problem:** Any authenticated user can call this RPC with another user's ID, corrupting their counters.
**Fix:** Add `IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION` at the top of the function body.

### 1.3 chat_history SELECT Policy Leak (C4) — Guest Flow Remnant

**File:** `supabase/migrations/20260203190126_initial_schema.sql:91`
**Problem:** `USING (user_id = auth.uid() OR is_guest = TRUE)` lets any authenticated user read ALL guest chat history rows. Direct leftover from old guest flow.
**Fix:**
- Drop and recreate SELECT policy: `USING (user_id = auth.uid())`
- Clean up orphaned guest rows (rows where `user_id IS NULL` or `is_guest = TRUE` with no matching auth user)
- Plan to drop `is_guest` column in a later migration after confirming no code references it

### 1.4 Conflicting CHECK Constraint Blocks Basic Tier (C7)

**File:** Migrations — original inline constraint vs newer migration
**Problem:** Original migration constrains tier to `('free','pro')`, later migration adds `('free','basic','pro')`. Both constraints active = basic tier writes fail entirely.
**Fix:** Drop the original inline constraint so only the newer one applies.

### 1.5 Webhook Errors Silently Swallowed (C8)

**File:** `src/app/api/webhook/dodo-payments/route.ts:19-33`
**Problem:** `upsertSubscription` and `updateProfileTier` don't check Supabase `{ error }`. Returns 200 even if DB write fails. User pays but tier never updates.
**Fix:** Check `{ error }` on every Supabase call, throw to return non-2xx so the payment processor retries.

### 1.6 Plan Defaults to Basic for Unknown Products (C9)

**File:** `activate/route.ts:43`, `webhook/route.ts:44-48`
**Problem:** Unrecognized product IDs silently get `basic` tier. Misconfigured env vars = free upgrades.
**Fix:** Validate against both known product IDs. Reject and log unknowns.

### 1.7 No Webhook Idempotency (C10)

**File:** `webhook/route.ts:35-42`
**Problem:** No `UNIQUE` constraint on `billing_events.dodo_event_id`. Duplicate webhook deliveries double-process.
**Fix:** Add `UNIQUE(dodo_event_id)` constraint. Check for existing event before processing.

---

## Phase 2: Auth, Performance & Guest Cleanup

### 2.1 Next.js Middleware for Server-Side Auth (C6) — Guest Flow Remnant

**File:** Missing `src/middleware.ts`
**Problem:** No server-side auth guard. Full JS bundle served to unauthenticated users before client-side redirect fires. Old flow didn't need this since guests were allowed everywhere.
**Fix:** Create `src/middleware.ts` with `@supabase/ssr` session check. Protect `/chat`, `/onboarding`, `/settings` routes. Allow `/`, `/about`, `/pricing`, `/auth`, `/api` to pass through.

### 2.2 Missing Index on memories Table (C12)

**File:** No migration adds it
**Problem:** Every memory read/count does a full table scan.
**Fix:** `CREATE INDEX ON memories (user_id, kind, created_at DESC)`

### 2.3 N+1 Waterfall in persistAsync (C11)

**File:** `src/app/api/chat/route.ts:1291-1450`
**Problem:** Gang lookup + double chat_history query on every chat request.
**Fix:** Cache `gang_id`. Merge dedup query into history select.

### 2.4 In-Memory Rate Limiting on Serverless (C13)

**File:** `src/lib/rate-limit.ts:10-34`
**Problem:** Each Vercel container has its own counter. Free-tier message limits are unenforceable.
**Fix:** Require `UPSTASH_REDIS_*` env vars in production. Fail closed if Redis is unavailable.

### 2.5 SHA-256 Admin Password (C5)

**File:** `src/lib/admin/auth.ts:44`
**Problem:** No salt. Trivially brute-forceable if hash leaks.
**Fix:** Use bcrypt or PBKDF2 with high iterations.

### 2.6 Drop is_guest Column — Final Guest Cleanup

**File:** New migration
**Problem:** Column is unused but still exists in schema and types.
**Fix:**
- Migration: `ALTER TABLE chat_history DROP COLUMN IF EXISTS is_guest;`
- Regenerate `database.types.ts` from Supabase

---

## Phase 3: Important Backend & Data Integrity

### 3.1 Memory Compaction Stuck Rows (I1)

**File:** `src/lib/ai/memory.ts:158-261`
**Problem:** Crash during compaction leaves rows in `compacting` state permanently. User loses memories.
**Fix:** Add safety query that resets stuck rows older than 5 minutes back to their previous state.

### 3.2 Non-Atomic Gang Member Updates (I2)

**File:** `src/app/auth/actions.ts:167-176`
**Problem:** `saveGang` deletes then inserts gang members non-atomically. Concurrent chat can see empty gang.
**Fix:** Use Supabase RPC transaction or upsert strategy.

### 3.3 Duplicate Dodo Customers on Double-Click (I3)

**File:** `src/app/api/checkout/route.ts:42-52`
**Problem:** Race condition creates duplicate customers.
**Fix:** Use `.is('dodo_customer_id', null)` conditional update.

### 3.4 user.email! Non-Null Assertion (I4)

**File:** `src/app/api/checkout/route.ts:44`
**Problem:** OAuth users may not have email. Crash.
**Fix:** Check for email; return 400 if missing.

### 3.5 Webhook Squad Restore Duplicate Key (I5)

**File:** `webhook/route.ts:70-115`
**Problem:** Can hit duplicate key error on squad restore.
**Fix:** Use upsert with `ON CONFLICT DO NOTHING`.

### 3.6 Characters Table No RLS (I6)

**File:** Migrations
**Problem:** No RLS enabled on characters table.
**Fix:** Enable RLS + add SELECT-only policy for authenticated users.

### 3.7 deleteAccount Silently Fails (I7)

**File:** `src/app/auth/actions.ts:119-133`
**Problem:** Auth error is swallowed, user gets no feedback.
**Fix:** Return error object, handle in UI.

### 3.8 RLS auth.uid() Per-Row Evaluation (I8)

**File:** Multiple tables
**Problem:** 9 RLS policies re-evaluate `auth.uid()` per-row instead of per-query.
**Fix:** Wrap in `(select auth.uid())` — free performance win.

### 3.9 Overlapping Permissive Policies (I9)

**File:** Migrations (billing_events + subscriptions)
**Problem:** Service-role policies target `public` role unnecessarily.
**Fix:** Scope to `TO service_role`.

### 3.10 Admin Cookie SameSite (I11)

**File:** `src/lib/admin/session.ts:63`
**Problem:** `SameSite: lax` instead of `strict`.
**Fix:** Change to `strict`. One-line change.

### 3.11 Webhook Bare Supabase Client (I19)

**File:** `webhook/route.ts:5-8`
**Problem:** Creates bare Supabase client at module scope, bypasses `createAdminClient()`.
**Fix:** Import from `lib/supabase/admin`.

---

## Phase 4: Important Frontend & Architecture

### 4.1 Stale Closure in Recursive sendToApi (I14)

**File:** `src/hooks/use-chat-api.ts:415,430`
**Problem:** Recursive call uses stale closure instead of ref.
**Fix:** Call `sendToApiRef.current(...)`.

### 4.2 fetchJourneyState Sequential Calls (I15)

**File:** `src/lib/supabase/client-journey.ts:23-56`
**Problem:** 3 sequential DB calls on every auth load.
**Fix:** Parallelize profile + gang with `Promise.all`.

### 4.3 Hydration Loading State (I23) — Guest Flow Remnant

**File:** `src/app/chat/page.tsx:188-199`
**Problem:** During store hydration, `userId` and `activeGang` are empty. Old flow didn't care (guests allowed). Now causes flash of empty UI before redirect.
**Fix:** Return loading skeleton when `!isHydrated`.

### 4.4 Replace alert()/confirm() (I20 + I21)

**Files:** `src/app/pricing/page.tsx:189,201` + `src/components/settings-panel.tsx:297`
**Problem:** Native browser dialogs look amateur.
**Fix:** Use InlineToast for checkout errors. Use in-page confirmation dialog for account deletion.

### 4.5 Checkout Success Fallback Button (I22)

**File:** `src/app/checkout/success/page.tsx:38,43`
**Problem:** No fallback if auto-redirect fails. User stuck.
**Fix:** Add "Go to chat" link/button.

### 4.6 Admin Tier Toggle Missing Basic (I24)

**File:** `src/app/admin/users/page.tsx:294`
**Problem:** Only toggles free/pro. Can't manage basic tier users.
**Fix:** Use `<select>` with all three tiers.

---

## Phase 5: Minor Fixes (Cherry-Picked)

### 5.1 Character Schema vs Tier Limit Mismatch (M2 + M3)

**Files:** `src/app/auth/actions.ts:26` vs `src/lib/billing.ts:15`, `chat/route.ts:557`
**Problem:** `characterIdsSchema` allows 6 but basic limit is 5. Chat route hard-caps at 4, ignoring pro tier's 6.
**Fix:** Align all limits to match tier config in `billing.ts`.

### 5.2 No DELETE Policy on squad_tier_members (M9)

**File:** Migrations
**Fix:** Add DELETE policy scoped to `user_id = auth.uid()`.

### 5.3 Admin Delete Chat History No Confirmation (M13)

**File:** `src/app/admin/users/page.tsx:323-331`
**Fix:** Add confirmation dialog before destructive action.

### 5.4 Avatar Lightbox Missing Escape Close (M14)

**File:** `src/components/chat/message-item.tsx:435-476`
**Fix:** Add `onKeyDown` handler for Escape key.

### 5.5 Paywall Countdown Timer Leaks Intervals (M17)

**File:** `src/components/paywall-popup.tsx:34-46`
**Problem:** `secondsLeft` in deps causes interval restart loop.
**Fix:** Remove `secondsLeft` from deps, use functional updater.

---

## Phase 6: Feature Additions

### 6.1 Character Relationship Progression

**Concept:** Track relationship depth per character (friendship level, inside jokes, milestones). Show visual progression (heart meters, friendship badges). Creates emotional investment and long-term retention.
**Approach:** Leverage existing memory system. Add `relationship_score` to character-user data. Surface in UI with subtle progression indicators.

### 6.2 Group Memory Highlights / "Remember When..."

**Concept:** Surface old shared memories as spontaneous character callbacks during conversation. ("Remember when you told me about your cat?"). The memory infrastructure already exists — this is about surfacing it proactively.
**Approach:** During chat, periodically query older memories and inject as character-initiated callbacks when contextually relevant.

---

## Summary Table

| Phase | Items | Priority | Estimated Effort |
|-------|-------|----------|-----------------|
| 1 — Critical Security & Billing | 7 fixes | SHIP-BLOCKING | Medium |
| 2 — Auth, Perf & Guest Cleanup | 6 fixes | HIGH | Medium |
| 3 — Important Backend | 11 fixes | HIGH | Medium-Large |
| 4 — Important Frontend | 6 fixes | MEDIUM | Medium |
| 5 — Minor Fixes | 5 fixes | LOW | Small |
| 6 — Features | 2 features | FUTURE | Large |

**Total: 37 fixes + 2 features**

---

## Excluded Items (From Original Audit)

| Item | Reason |
|------|--------|
| M8 — Streamed responses | User preference: not wanted |
| Feature #1 — Streaming | User preference: not wanted |
| Feature #2 — Push notifications | User preference: not wanted |
| Feature #5 — Voice messages | Deferred to future |
| I10 — Leaked password protection | Dashboard toggle, not code |
| I12 — useCapacityManager full store sub | Minor perf, not user-facing |
| I13 — useChatHistory full store sub | Minor perf, not user-facing |
| I16 — History polling interval restart | Low-impact timing |
| I17 — Duplicated hasOpenFloorIntent | Code smell, not a bug |
| I18 — useTypingSimulation mounted guard | Edge case |
| M1, M4, M5, M6, M7, M10, M11, M12, M15, M16, M18 | Low impact or cosmetic |
