# MyGang.ai — Comprehensive Audit & Fix Plan

**Date:** 2026-03-05
**Audited by:** 4 parallel agents (Security, UI/UX, Logic/State, Database)

---

## Summary

**Total issues found: 47**
- Critical: 10
- Important: 22
- Minor/Low: 15

---

## PHASE 1: CRITICAL SECURITY FIXES (Do First)

### 1.1 Admin password hashing uses SHA-256 instead of bcrypt/argon2
- **File:** `src/lib/admin/auth.ts:46`
- **Bug:** SHA-256 is a fast hash — billions of guesses/sec with GPU. Also accepts raw hash as password.
- **Fix:** Switch to `bcrypt`. Remove the "accepts raw SHA-256 hash" code path.

### 1.2 In-memory rate limiter useless on serverless (resets per cold start)
- **File:** `src/lib/rate-limit.ts:10`
- **Bug:** `Map<>` resets per container. Attackers bypass limits by hitting different instances.
- **Fix:** Require Upstash Redis in production. Throw if env vars missing when `NODE_ENV=production`.

### 1.3 Admin login lockout also in-memory (same serverless issue)
- **File:** `src/lib/admin/login-security.ts:11`
- **Bug:** 5-attempt lockout resets per container — unlimited brute force possible.
- **Fix:** Store lockout state in Redis or a Supabase table.

### 1.4 CSP allows `unsafe-inline` + `unsafe-eval` (XSS defense nullified)
- **File:** `next.config.ts:14`
- **Bug:** Any future XSS vector would execute freely.
- **Fix:** Use nonce-based CSP. Next.js 13+ supports nonce generation in middleware.

### 1.5 Guest INSERT policy on `chat_history` allows cross-user pollution
- **File:** `supabase/migrations/20260203190126_initial_schema.sql:93-94`
- **Bug:** `is_guest = TRUE` lets anyone insert into any `gang_id` without auth.
- **Fix:** Remove `OR is_guest = TRUE` from INSERT policy. Guest persistence is server-side via admin client.

### 1.6 No vector index on `memories.embedding` — full table scan
- **File:** All migrations (missing)
- **Bug:** Every `match_memories` call does O(n) sequential scan. Will degrade with scale.
- **Fix:** Add HNSW index: `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`.

### 1.7 Guest users have no daily message cap
- **File:** `src/app/api/chat/route.ts:645`
- **Bug:** Daily limit check only runs for authenticated users. Guests can spam the LLM.
- **Fix:** Track guest daily count by IP in Redis, or reduce guest limit further.

### 1.8 `persistAsync` is fire-and-forget — may be killed before completion
- **File:** `src/app/api/chat/route.ts:1358`
- **Bug:** On serverless, async work after `return` is not guaranteed to complete. Chat history, memories, and relationship updates may be silently dropped.
- **Fix:** Use `waitUntil` from `@vercel/functions` to register background work.

### 1.9 "Use Cloud" in squad reconcile doesn't persist to DB
- **File:** `src/components/orchestrator/squad-reconcile.tsx:53-67`
- **Bug:** Sets local Zustand state but never calls `saveGang()`. Next login triggers conflict loop again.
- **Fix:** Add `await saveGang(remote.map(c => c.id))` in `handleUseCloud`.

### 1.10 Race condition: pending retry fires without re-locking `isGeneratingRef`
- **File:** `src/hooks/use-chat-api.ts:401-408`
- **Bug:** `sendToApi` called without await in finally block. Two concurrent API calls possible.
- **Fix:** Set `isGeneratingRef.current = true` before the retry fires.

---

## PHASE 2: IMPORTANT BUGS & LOGIC FIXES

### 2.1 `trackEvent` fires before error check — corrupts analytics
- **File:** `src/hooks/use-chat-api.ts:252`
- **Fix:** Move `trackEvent` after the `!res.ok` check.

### 2.2 Stale `messages` closure in `handleSend`
- **File:** `src/hooks/use-chat-api.ts:506-507`
- **Fix:** Read from `useChatStore.getState().messages` instead of prop.

### 2.3 Greeting timers fire after unmount — phantom messages
- **File:** `src/hooks/use-autonomous-flow.ts:75-81`
- **Fix:** Add an `isMounted` ref guard. Clear all timers on unmount properly.

### 2.4 `setIsHydrated(false)` fires on every token refresh
- **File:** `src/components/orchestrator/auth-manager.tsx:45`
- **Fix:** Only set `isHydrated(false)` on initial load, not token refreshes.

### 2.5 `recordCapacityError` closes over stale `lowCostMode`
- **File:** `src/hooks/use-capacity-manager.ts:38-64`
- **Fix:** Read `lowCostMode` from `useChatStore.getState()` at call time.

### 2.6 Memory pagination uses `lte` instead of `lt` — duplicates
- **File:** `src/app/auth/actions.ts:308`
- **Fix:** Change `.lte('created_at', params.before)` to `.lt(...)`.

### 2.7 `compactMemoriesIfNeeded` race — double compaction
- **File:** `src/lib/ai/memory.ts:158-232`
- **Fix:** Use optimistic locking — mark memories as 'compacting' atomically before processing.

### 2.8 Missing `(user_id, kind, created_at)` index on memories
- **Fix:** Add composite index for common query patterns.

### 2.9 Gang upsert runs on every request
- **File:** `src/app/api/chat/route.ts:1185-1189`
- **Fix:** Do a `select` first; only upsert if no gang exists.

### 2.10 `last_active_at` written twice concurrently
- **File:** `src/app/api/chat/route.ts:1151-1162`
- **Fix:** Add `last_active_at` update to the `increment_profile_counters` RPC.

### 2.11 Daily counter reset TOCTOU race at 24h rollover
- **File:** `src/app/api/chat/route.ts:656-663`
- **Fix:** Move reset logic into the atomic RPC function.

### 2.12 No middleware — admin routes rely solely on RSC auth checks
- **Fix:** Add `middleware.ts` that guards `/admin/(protected)/` routes at the edge.

### 2.13 `assertTrustedAdminRequest` bypassed when Origin + Referer absent
- **File:** `src/lib/admin/request-guard.ts:34-45`
- **Fix:** Return `false` when both headers are absent (deny by default).

### 2.14 Rapid `pulseStatus` calls clear second status early
- **File:** `src/hooks/use-typing-simulation.ts:78-88`
- **Fix:** Track a generation counter per character to avoid stale timer callbacks.

### 2.15 Module-level cache stampede on concurrent invalidations
- **File:** `src/app/api/chat/route.ts:35-58`
- **Fix:** Add a simple "fetching" flag to prevent concurrent refetches.

---

## PHASE 3: UI/UX FIXES

### 3.1 `select-none` prevents message copying on mobile
- **File:** `src/components/chat/message-item.tsx:352`
- **Fix:** Remove `select-none` from bubble wrapper. Keep `select-text` on `<p>`.

### 3.2 Skip link target `#main-content` missing from DOM
- **File:** `src/app/layout.tsx:99`
- **Fix:** Add `id="main-content"` to `<main>` in each page.

### 3.3 No back navigation in onboarding flow
- **File:** `src/app/onboarding/page.tsx`
- **Fix:** Add back button on IDENTITY and SELECTION steps.

### 3.4 Settings panel delete account skips email confirmation
- **File:** `src/components/settings/settings-panel.tsx:156-167`
- **Fix:** Apply same email-confirmation pattern from `chat-settings.tsx`.

### 3.5 Hidden settings panels remain in keyboard tab order
- **File:** `src/components/chat/chat-settings.tsx:238`
- **Fix:** Add `inert` attribute on inactive panel wrappers.

### 3.6 No empty state when chat has zero messages
- **File:** `src/components/chat/message-list.tsx`
- **Fix:** Add empty-state UI with "Say hello" prompt and gang avatars.

### 3.7 Carousel dots have no visible focus ring
- **File:** `src/components/landing/landing-page.tsx:753`
- **Fix:** Add `focus-visible:ring-2 focus-visible:ring-primary`.

### 3.8 Keyboard focus lost on carousel slide change
- **File:** `src/components/landing/landing-page.tsx:716`
- **Fix:** Return focus to clicked button after slide change.

### 3.9 Timestamps invisible on touch tablets
- **File:** `src/components/chat/message-item.tsx:482`
- **Fix:** Keep timestamps always visible, or add tap-to-reveal.

### 3.10 Deselect avatars are inaccessible `div`s, invisible on mobile
- **File:** `src/components/onboarding/selection-step.tsx:204`
- **Fix:** Convert to `<button>` with `aria-label`. Show X badge on mobile.

### 3.11 Status text cycling ignores `prefersReducedMotion`
- **File:** `src/components/onboarding/loading-step.tsx:22`
- **Fix:** Show static message when reduced motion is preferred.

### 3.12 Duplicate feature cards in "Why It Feels Real"
- **File:** `src/components/landing/landing-page.tsx:126`
- **Fix:** Replace duplicate with a distinct feature (e.g., "Memory that sticks").

### 3.13 FAQ items all forced `open` — expand/collapse non-functional
- **File:** `src/components/landing/landing-page.tsx:537`
- **Fix:** Remove hardcoded `open` attribute.

### 3.14 MemoryVault focus trap may miss dynamic content
- **File:** `src/components/chat/memory-vault.tsx:55`
- **Fix:** Use `requestAnimationFrame` in trap handler, or use `focus-trap-react`.

---

## PHASE 4: DATABASE & MINOR FIXES

### 4.1 Admin tables have RLS enabled but zero policies
- **File:** `supabase/migrations/20260210224000_add_admin_runtime_controls.sql`
- **Fix:** Add explicit `USING (false)` policies to document intent.

### 4.2 No INSERT RLS policy on `profiles`
- **Fix:** Add INSERT policy as defense-in-depth for trigger failure.

### 4.3 Duplicate `match_memories` migration file
- **Fix:** Remove `20260204000000_match_memories.sql`. Keep the `public.`-prefixed version.

### 4.4 `server.ts` uses `!` assertions instead of validated env checks
- **File:** `src/lib/supabase/server.ts:9-10`
- **Fix:** Add proper validation like `client.ts` does.

### 4.5 Singleton admin client shared across requests
- **File:** `src/lib/supabase/admin.ts:4-18`
- **Fix:** Consider per-request creation (low priority).

### 4.6 `aria-busy` on load-earlier button doesn't notify screen readers
- **File:** `src/components/chat/message-list.tsx:254`
- **Fix:** Add `aria-live="polite"` to the wrapping container.

### 4.7 Chat loading spinner has no accessible label
- **File:** `src/app/chat/loading.tsx`
- **Fix:** Add `role="status" aria-label="Loading chat"`.

### 4.8 `IdentityStep` ignores `prefersReducedMotion`
- **File:** `src/components/onboarding/identity-step.tsx:19-23`
- **Fix:** Check `useReducedMotion()` like other steps.

---

## EXECUTION ORDER

| Phase | Effort | Items | Priority |
|-------|--------|-------|----------|
| Phase 1 | ~4-6 hours | 10 critical fixes | IMMEDIATE |
| Phase 2 | ~3-4 hours | 15 important bugs | HIGH |
| Phase 3 | ~3-4 hours | 14 UI/UX fixes | MEDIUM |
| Phase 4 | ~1-2 hours | 8 minor/DB fixes | LOW |

**Recommended approach:** Fix Phase 1 items first (security + data integrity), then Phase 2 (logic bugs), then Phase 3+4 together.
