# MyGang Full Codebase Review — March 16, 2026

**Orchestrator:** Senior Dev / CEO perspective
**Review team:** 6 specialist agents (Backend, Frontend, Architecture, Security, AI/Chat, Data/Billing)
**Scope:** All source files across `src/`, config, public assets, and infrastructure
**Status:** Read-only audit — no code changes made

---

## Executive Summary

The codebase is in solid shape for a 3-month-old product. Fundamentals are correct: typed DB schema, Zod-validated env vars, idempotent webhooks, fail-closed rate limiting, constant-time admin auth. Three prior audit passes are visible in the code quality.

**However, this review found 11 critical/high issues that need immediate attention**, including an exploitable rate limit bypass, a prompt injection vector, a missing safety filter on WYWA content, and false advertising on the pricing page.

---

## Issue Summary by Severity

| Severity | Count | Immediate Action Required |
|----------|-------|--------------------------|
| CRITICAL | 8 | Yes — security, billing, data loss |
| HIGH | 12 | Yes — within 1-2 weeks |
| MEDIUM | 15 | Scheduled — next sprint |
| LOW | 10 | Backlog |

---

## CRITICAL ISSUES (Fix Immediately)

### 1. Rate Limit Bypass via Speaker Manipulation
**Source:** Data/Billing review (CRIT-1), Backend review (related)
**File:** `src/app/api/chat/route.ts` ~line 854
**Impact:** Any free user can get unlimited AI responses per hour

The hourly rate limit (25/hr free, 40/hr basic) only checks when `hasFreshUserTurn = latestMessage?.speaker === 'user'`. A crafted POST with the last message speaker set to a character name bypasses the hourly cap entirely. The global 60/min burst limit still applies, but the tier-specific hourly limit is completely skipped.

**Fix:** Check rate limit on every authenticated POST that triggers an LLM call, regardless of speaker.

---

### 2. Prompt Injection via userName/userNickname
**Source:** Backend (C-1), Security (CRIT-2), AI/Chat (I-2) — all three flagged this independently
**File:** `src/app/api/chat/route.ts` lines 581-582, `src/lib/ai/system-prompt.ts`
**Impact:** Any authenticated user can manipulate AI behavior

`userName` and `userNickname` have no `.max()` constraint in the Zod schema. They're injected verbatim into the **system prompt** (highest-authority position). The server fetches the real username from DB (`profileRow`) but never uses it — it uses the client-provided value instead.

**Fix:** Use `profileRow?.username` for `userName`. Add `.max(64)` to both fields. Strip newlines.

---

### 3. WYWA Content Has No Safety Filter
**Source:** AI/Chat review (C-2)
**File:** `src/lib/ai/wywa.ts` lines 307-330
**Impact:** Potentially harmful AI content stored and displayed to users

The main chat route applies `detectUnsafeContent` to every AI message. WYWA has no equivalent — LLM output goes straight to the DB after basic schema validation only.

**Fix:** Apply `detectUnsafeContent` to each WYWA message before insertion.

---

### 4. DodoPayments Silently Defaults to test_mode in Production
**Source:** Security (CRIT-1), Architecture (C-2)
**File:** `src/lib/billing-server.ts` line 7, `src/app/api/customer-portal/route.ts` line 12
**Impact:** Payment processing silently broken if env var missing/wrong

`DODO_PAYMENTS_ENVIRONMENT` defaults to `'test_mode'` if not exactly `'live_mode'`. Missing env var = test mode. No error, no warning.

**Fix:** Add to `env.ts` schema as `z.enum(['live_mode', 'test_mode'])`. Fail at startup if missing.

---

### 5. Pricing Page Falsely Advertises "No Hourly Cooldowns" for Basic
**Source:** Data/Billing review (CRIT-2)
**File:** `src/lib/billing.ts` line 32, `src/app/pricing/page.tsx` line 367
**Impact:** Legal exposure, chargeback risk

Basic tier has a 40 msgs/hr sliding window with a visible cooldown timer. The pricing page says "No hourly cooldowns." This is factually wrong and a consumer protection issue under DPDPA.

**Fix:** Change to "40 msgs/hr, then short cooldown" or similar accurate copy.

---

### 6. Split Bubble Second Message Silently Dropped
**Source:** AI/Chat review (C-1)
**File:** `src/app/api/chat/route.ts` — `maybeSplitAiMessages` function
**Impact:** Users see only half of split messages

When splitting a message into two bubbles, both halves get the same `message_id`. The client-side dedup guard drops the second bubble. `normalizeEventWritingStyle` correctly clears the ID; `maybeSplitAiMessages` doesn't.

**Fix:** Set `message_id: undefined` on the second bubble in `maybeSplitAiMessages`.

---

### 7. Memory Quota TOCTOU Race Condition
**Source:** Backend review (C-2)
**File:** `src/lib/ai/memory.ts` lines 247-278
**Impact:** Memory limits can be exceeded under concurrent requests

Count-then-insert across separate round trips. Two concurrent chat requests that both pass the count check will both insert, exceeding limits.

**Fix:** Move to atomic DB operation (Postgres function or CTE).

---

### 8. /dev Preview Pages Live in Production
**Source:** Architecture review (C-1)
**Files:** `src/app/dev/avatar-gift-preview/page.tsx`, `avatar-style-preview/page.tsx`, `vibe-quiz-preview/page.tsx`
**Impact:** Internal UI exposed to public, not blocked by robots.txt

**Fix:** Add `if (process.env.NODE_ENV !== 'development') notFound()` or delete entirely.

---

## HIGH ISSUES (Fix Within 1-2 Weeks)

### 9. No Subscription Expiry Fallback
**Source:** Data/Billing (CRIT-3)
**File:** Webhook handler
If the `subscription.expired` webhook fails delivery, the user retains paid access forever. No cron or request-time check exists.
**Fix:** Add request-time check comparing `current_period_end` to now.

### 10. Pro Tier Context Limit Exceeds Schema Maximum
**Source:** AI/Chat (I-1)
**Files:** `route.ts` line 578, `use-chat-api.ts`
Pro sends up to 50 messages; server schema `.max(40)` rejects them with a generic error.
**Fix:** Raise schema max to 60 or lower Pro limit to 40. ///raise schema max to 60

### 11. Terms Agreement Bypass via Enter Key
**Source:** Frontend (C1)
**File:** `src/components/orchestrator/auth-wall.tsx`
Pressing Enter in the password field submits the form without checking `agreedToTerms`.
**Fix:** Add terms check inside `handleSubmit`.

### 12. Mobile Avatar Preview Invisible (CSS Regression)
**Source:** Frontend (C2)
**File:** `src/components/chat/chat-header.tsx`
The lightbox has `hidden sm:flex` — invisible below 640px. Commit `90bc30e` added mobile click support but the CSS blocks it.
**Fix:** Remove `hidden sm:flex`, use `flex` on all breakpoints.

### 13. Admin Brute-Force Protection Fails Open on Redis Outage
**Source:** Security (HIGH-1)
**File:** `src/lib/admin/login-security.ts`
Redis errors return `null` → fresh state → lockout unreachable. Should fail closed.
**Fix:** Return locked state when Redis throws.

### 14. Push Subscription Endpoint Has No Rate Limiting
**Source:** Security (HIGH-2)
**File:** `src/app/api/push/subscription/route.ts`
Only authenticated endpoint without rate limiting. Allows unbounded row creation.
**Fix:** Add `rateLimit()` consistent with other endpoints.

### 15. Missing Env Vars in Startup Validation
**Source:** Security (HIGH-4), Architecture (C-2)
**File:** `src/lib/env.ts`
`DODO_PAYMENTS_RETURN_URL`, `CRON_SECRET`, `ADMIN_PANEL_EMAIL`, `ADMIN_PANEL_PASSWORD_HASH` all used with `!` assertions but not validated at startup.
**Fix:** Add all to `envSchema`.

### 16. lottie-react on Critical Bundle Path
**Source:** Frontend (C3)
**File:** `src/components/ui/lottie-loader.tsx`
Static import puts lottie-react in the synchronous bundle for chat loading. Other components correctly use lazy loading.
**Fix:** Use `next/dynamic` or `React.lazy`.

### 17. No External Error Monitoring
**Source:** Architecture (H-1)
All errors go to `console.error`. No Sentry, no alerting. Billing failures could go unnoticed for days.
**Fix:** Add Sentry (free tier sufficient).

### 18. Multiple LazyMotion Providers
**Source:** Frontend (H1)
8 components each wrap in `<LazyMotion features={domAnimation}>`. Should be a single root provider.
**Fix:** Move to root layout, remove per-component wrappers.

### 19. purchase_celebration_pending Type Mismatch
**Source:** Architecture (H-3)
**Files:** webhook handler, checkout/activate
TypeScript says `string | null`, DB appears `boolean`. Two files have `as unknown as` casts with boolean fallback.
**Fix:** Run migration to make column `text`, regenerate types, remove fallbacks.

### 20. Refund/Dispute Handlers Update ALL User Subscriptions
**Source:** Data/Billing (IMP-5)
A refund on an old subscription can mark the current active one as refunded.
**Fix:** Narrow update to specific subscription ID from the webhook payload.

---

## MEDIUM ISSUES (Next Sprint)

| # | Issue | Source | File |
|---|-------|--------|------|
| 21 | Compaction leaves memories stuck on archive failure | Backend M-1 | memory.ts |
| 22 | Compaction reset corrupts concurrent runs | Backend M-2 | memory.ts |
| 23 | Serial LLM calls in compaction exceed waitUntil budget | Backend M-3 | memory.ts |
| 24 | memoriesSavedCount computed before quality filter | Backend M-4 | route.ts |
| 25 | 7-day memory recency window penalizes identity facts | AI/Chat M-1 | memory.ts |
| 26 | burstCount accepted but never used server-side | AI/Chat M-2 | route.ts |
| 27 | hasOpenFloorIntent duplicated server/client | AI/Chat I-3 | route.ts, use-autonomous-flow.ts |
| 28 | Duplicate admin HMAC verification code | Security MED-1 | proxy.ts, session.ts |
| 29 | Revoked admin sessions pass proxy layer | Security HIGH-3 | proxy.ts |
| 30 | profiles table too wide (26 columns, mixed concerns) | Architecture M-1 | database.types.ts |
| 31 | No DB enum constraints on tier/kind/category | Architecture M-2 | database.types.ts |
| 32 | Public pages not statically generated | Architecture M-3 | about, pricing, terms, privacy |
| 33 | Image cache TTL only 1 hour for static avatars | Architecture M-4 | next.config.ts |
| 34 | CSP contains unsafe-eval (lottie dependency) | Architecture H-5 | next.config.ts |
| 35 | billing_events idempotency constraint unverified | Data/Billing IMP-7 | webhook handler |

---

## LOW ISSUES (Backlog)

| # | Issue | Source |
|---|-------|--------|
| 36 | Dead code: storeMemory, retrieveMemories, retrieveMemoriesLite | Backend L-1, AI/Chat M-3 |
| 37 | Dead code: freshUserMessageCount, burstCount, isFirstMessage | Backend L-2 |
| 38 | touchMemories has no user_id filter | Backend L-3 |
| 39 | messagesRemaining persisted to localStorage (stale on reload) | Backend L-4 |
| 40 | billing-server.ts non-null assertion on API key | Backend L-5 |
| 41 | Duplicate PNG assets in public/ (~1.5-4MB dead weight) | Architecture H-4 |
| 42 | Three DodoPayments packages in dependencies | Architecture M-5 |
| 43 | TypeScript target ES2017 (should be ES2022) | Architecture M-6 |
| 44 | poweredByHeader not disabled | Architecture M-7 |
| 45 | Personal email in JSON-LD structured data | Frontend (notable) |

---

## Accessibility Issues (Frontend)

| # | Issue | File |
|---|-------|------|
| A1 | Onboarding selection modal: no Escape key, no role="dialog" | selection-step.tsx |
| A2 | Message action buttons below 44px touch target | message-item.tsx |
| A3 | ConfettiCelebration missing aria-hidden | confetti-celebration.tsx |
| A4 | Onboarding progress dots inaccessible to screen readers | onboarding/page.tsx |
| A5 | FAQ buttons lack aria-controls | pricing/page.tsx |
| A6 | pl-6.5 is not a valid Tailwind class (error text misaligned) | auth-wall.tsx |
| A7 | BackgroundBlobs still applies blur on low-end devices | background-blobs.tsx |
| A8 | Settings page has no error boundary | settings/page.tsx |

---

## What's Working Well

The review team noted these as strong patterns across the codebase:

- **Webhook idempotency** via INSERT ON CONFLICT is correctly implemented
- **Auth callback redirect** uses exact-match allowlist — no open redirect possible
- **Checkout ownership** verifies customer_id before activating
- **Admin brute force design** with IP + email dual lockout and PBKDF2 is solid
- **CSRF protection** for admin actions correctly blocks mismatched Origin/Referer
- **Rate limiting coverage** is consistent (except push subscription)
- **Input validation** via Zod schemas is thorough across all routes
- **Service role key isolation** — admin client never used client-side
- **Supabase client factory** (admin/server/client split) is clean
- **Fail-closed rate limiting** in production is the right call
- **Memory system** hybrid retrieval design is well-architected
- **Autonomous flow** guards are comprehensive (low-cost mode, ecosystem, backoff, tab visibility)
- **Character personality system** with modular prompt blocks is well-structured

---

## Proposed Fix Plan

### Phase 1: Critical Security & Billing (Day 1)
1. Fix rate limit bypass (speaker manipulation) — `route.ts`
2. Fix prompt injection (userName/userNickname) — `route.ts`, `system-prompt.ts`
3. Add WYWA safety filter — `wywa.ts`
4. Add `DODO_PAYMENTS_ENVIRONMENT` to env validation — `env.ts`
5. Fix pricing page false advertising — `billing.ts`, `pricing/page.tsx`
6. Fix split bubble message loss — `route.ts`
7. Block /dev pages in production — 3 dev page files
8. Fix memory quota race condition — `memory.ts`

### Phase 2: High Priority (Days 2-4)
9. Add subscription expiry fallback check — `route.ts`
10. Fix Pro context limit vs schema max — `route.ts`
11. Fix terms agreement bypass — `auth-wall.tsx`
12. Fix mobile avatar preview CSS — `chat-header.tsx`
13. Fix admin brute-force fail-open — `login-security.ts`
14. Add push subscription rate limiting — `push/subscription/route.ts`
15. Add missing env vars to validation — `env.ts`
16. Lazy-load lottie-react in loader — `lottie-loader.tsx`
17. Set up Sentry error monitoring
18. Single LazyMotion provider — root layout + 8 component files
19. Fix purchase_celebration_pending type — DB migration
20. Fix refund/dispute subscription targeting — webhook handler

### Phase 3: Medium Priority (Week 2)
21-35. Memory system fixes, static generation, cache TTL, CSP, DB constraints, etc.

### Phase 4: Cleanup (Backlog)
36-45. Dead code removal, asset cleanup, config tweaks

---

## Metrics

- **Total files reviewed:** ~80+ source files
- **Total findings:** 45 actionable issues + 8 accessibility issues
- **Critical/High requiring immediate action:** 20
- **Estimated Phase 1 effort:** 4-6 hours
- **Estimated Phase 2 effort:** 2-3 days
