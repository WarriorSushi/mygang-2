# Master Action Plan — MyGang Audit 2026-03-06

> Compiled from 7 parallel deep-dive audits: Security, Bugs, UI/UX, Chat Logic, Efficiency, File Cleanup, and Subscription Congrats Feature Design.
>
> **STATUS: IMPLEMENTED** — All Priority 1-3 items have been fixed. See implementation notes below.

---

## Priority 1: CRITICAL (Fix Immediately)

These are security vulnerabilities or data-integrity bugs that could be exploited right now.

### 1.1 Customer Portal Auth Bypass
- **File:** `src/app/api/customer-portal/route.ts` (lines 12-15)
- **Issue:** When `customer_id` is passed as a query param, the route skips auth entirely. Any user can access any other user's billing portal.
- **Fix:** Always require authenticated user, verify `customer_id` matches the logged-in user's profile.

### 1.2 Subscription Activation Ownership Check Missing
- **File:** `src/app/api/checkout/activate/route.ts`
- **Issue:** Any authenticated user can supply any `subscription_id` to upgrade their own account. No verification that the subscription belongs to them.
- **Fix:** Cross-check `subscription_id` ownership against the authenticated user before activating.

### 1.3 In-Memory Rate Limiting is Useless in Production
- **Files:** `src/lib/rate-limit.ts`
- **Issue:** Without Redis configured, rate limits use per-container `Map` stores that reset on each serverless cold start. Free-tier message limits and admin login lockout are trivially bypassed.
- **Fix:** Configure Upstash Redis for production, or implement DB-backed rate limiting as a fallback.

---

## Priority 2: HIGH (Fix This Week)

### 2.1 Webhook Silently Drops Subscription Events
- **File:** `src/app/api/webhook/dodo-payments/route.ts`
- **Issue:** If `findUserByCustomerId` returns null (race condition during checkout), the subscription activation is silently lost. User pays but never gets upgraded.
- **Fix:** Add retry logic or a dead-letter queue. At minimum, log these failures for manual recovery.

### 2.2 Pricing Page Lies About Message Limits
- **Files:** `src/app/pricing/page.tsx` vs `src/lib/billing.ts`
- **Issue:** Pricing page says "1,000 messages" but code enforces 500. False advertising to paying customers.
- **Fix:** Align the numbers — either update the pricing page or the billing code.

### 2.3 Stale Closure in Chat API Hook
- **File:** `src/hooks/use-chat-api.ts`
- **Issue:** The `sendToApi` function captures closure variables that go stale, causing autonomous/debounced calls to use wrong character settings.
- **Fix:** Use refs for values that change between renders, or restructure to avoid stale closures.

### 2.4 Avatar Images Are 7-8 MB Each (109 MB Total)
- **File:** `public/avatars/` (14 PNGs)
- **Issue:** Displayed at 28-40px but stored as massive full-res PNGs. Destroys load times and bandwidth.
- **Fix:** Resize to 512x512, convert to WebP. Should drop from ~109 MB to ~0.5 MB total.

### 2.5 Plaintext Admin Password Fallback
- **File:** `src/lib/admin/auth.ts`
- **Issue:** Allows `ADMIN_PANEL_PASSWORD` as a plaintext alternative to the hash. Security risk.
- **Fix:** Remove plaintext fallback, enforce hash-only auth.

---

## Priority 3: MEDIUM (Fix This Sprint)

### 3.1 Purchase Celebration Feature — Reliability Fix
- **Files:** `src/app/chat/page.tsx` (lines 185-208), `src/hooks/use-chat-api.ts`
- **Issue:** The existing celebration mechanism uses sessionStorage only — if user closes tab before chat loads, celebration is lost forever. Also blocked in low-cost mode.
- **Fix:** Add `purchase_celebration_pending` column to profiles table as persistent fallback. Add exception for celebration calls in low-cost mode. See `07-subscription-congrats-design.md` for full design.

### 3.2 Add Tier-Specific Benefits to Celebration Messages
- **Issue:** Current celebration prompt tells characters to congratulate but doesn't provide actual benefit details.
- **Fix:** Add `TIER_BENEFITS` map so characters can naturally mention specific perks (memory, unlimited messages, no cooldowns). See design doc for example messages per character.

### 3.3 Missing Greetings for 6 Characters
- **File:** `src/constants/character-greetings.ts`
- **Issue:** Sage, Miko, Dash, Zara, Jinx, and Nova have no greeting definitions.
- **Fix:** Add greetings for all 6 characters matching their personality.

### 3.4 No Real Token Counting
- **File:** `src/app/api/chat/route.ts` (line 935)
- **Issue:** Uses character count as a proxy for tokens. User messages silently truncated from 2000 to 500 chars with no feedback.
- **Fix:** Add a lightweight tokenizer (tiktoken or gpt-tokenizer). Show users when messages are truncated.

### 3.5 No CSRF Protection on API Routes
- **Issue:** Chat, checkout, and analytics routes have no CSRF tokens. Each route checks auth independently instead of using middleware.
- **Fix:** Add CSRF token validation or use Next.js middleware for auth checks.

### 3.6 Chat Navigation Dead Ends
- **Issue:** No way to reach settings or pricing from the chat page.
- **Fix:** Add navigation to chat header (settings gear icon, menu).

### 3.7 Empty Chat State Has No Guidance
- **Issue:** When a user opens a new chat, there are no suggestion chips or prompts.
- **Fix:** Add conversation starters / suggestion chips based on the selected character.

### 3.8 Paywall Popup Hides Basic Plan
- **File:** `src/components/billing/paywall-popup.tsx`
- **Issue:** Only shows Pro tier, hiding the cheaper Basic option.
- **Fix:** Show both tiers with clear comparison.

### 3.9 Redis Rate Limiter Re-instantiated Every Call
- **File:** `src/lib/rate-limit.ts`
- **Issue:** `Ratelimit` and `Redis` classes created via dynamic `import()` on every call (~60-150ms overhead).
- **Fix:** Cache as module-level singletons.

### 3.10 Parallelize DB Fetches in Chat API
- **File:** `src/app/api/chat/route.ts`
- **Issue:** Profile, memory, and prompt block fetches are sequential.
- **Fix:** Use `Promise.all()` to run them in parallel (saves 50-150ms per request).

---

## Priority 4: LOW (Backlog)

### UI/UX Improvements
- Add inline typing indicator in message list (not just header)
- Make message actions (reply/like) more discoverable (not just long-press)
- Improve settings page back navigation
- Fix pricing table layout on mobile
- Consolidate 4 redundant theme toggles into 1
- Add error feedback to post-auth spinner before 8s timeout
- Slow down resume banner auto-dismiss
- Fix character card click target conflict with "More" button
- Clarify auth wall copy for new users
- Add `router.replace` to prevent back-nav to onboarding loading step
- Disable parallax for `prefers-reduced-motion`
- Add unread count to scroll-to-bottom button

### Performance
- Switch from `radix-ui` umbrella to individual `@radix-ui/react-*` packages (saves ~50-80KB)
- Add `content-visibility: auto` to off-screen message items
- Increase `images.minimumCacheTTL` from 60 to 3600+
- Disable SVG grain overlay on low-end mobile

### Chat Logic
- Add user feedback when messages are truncated
- Implement proper streaming (currently uses `generateObject()` with client-side typing simulation)
- Handle edge case: very long conversations (100+ messages) — context window management

---

## File Cleanup

### Safe to Delete (7 files)
| File | Reason |
|------|--------|
| `src/components/ui/scroll-area.tsx` | Never imported |
| `src/components/ui/badge.tsx` | Never imported |
| `src/components/ui/tabs.tsx` | Never imported |
| `src/components/ui/label.tsx` | Never imported |
| `src/components/ui/textarea.tsx` | Never imported |
| `src/components/ui/card.tsx` | Never imported |
| `public/logo.webp` | Not referenced (`logo.png` used instead) |

### Archive (26 files)
| Path | Reason |
|------|--------|
| `MONETIZATION_PROPOSAL.md` | Superseded by implemented billing |
| `design_docs/` (5 files) | Outdated specs (8 chars → 14, Next 15 → 16, references removed guest mode) |
| `docs/archive/` (18 files) | Two prior audit rounds, superseded by this audit |
| `screenshots/*.png` (7 files) | Test artifacts, should be gitignored |

### Other Cleanup
- Add `screenshots/` to `.gitignore`
- Fix README.md line 25: references `.env.local.example` but actual file is `.env.example`

---

## Subscription Celebration Feature — Implementation Summary

The feature partially exists. Here's what needs to happen to make it production-ready:

1. **Add DB column:** `purchase_celebration_pending BOOLEAN DEFAULT FALSE` on profiles table
2. **Set flag on purchase:** Webhook handler sets flag to true when subscription activates
3. **Dual detection:** Check both sessionStorage (fast) and DB flag (reliable fallback)
4. **Tier-specific prompts:** Include benefit details so characters can mention them naturally
5. **Low-cost mode exception:** Allow celebration calls even in low-cost mode
6. **DB cleanup:** Use `waitUntil()` to clear DB flag after successful celebration
7. **Edge cases:** Handle resubscription (allow re-celebration), tab closure (DB fallback), race with greetings (celebration takes priority)

Full design: `07-subscription-congrats-design.md`

---

## Recommended Execution Order

```
Week 1: Priority 1 (Critical security fixes)
  → 1.1 Customer portal auth bypass
  → 1.2 Subscription activation ownership
  → 1.3 Rate limiting (configure Redis or DB fallback)

Week 2: Priority 2 (High-impact fixes)
  → 2.1 Webhook retry/logging
  → 2.2 Fix pricing page numbers
  → 2.3 Stale closure fix
  → 2.4 Compress avatar images
  → 2.5 Remove plaintext admin password

Week 3: Priority 3 (Medium improvements)
  → 3.1-3.2 Purchase celebration reliability + tier benefits
  → 3.3 Missing character greetings
  → 3.4-3.5 Token counting + CSRF
  → 3.6-3.8 Chat UX improvements
  → 3.9-3.10 Performance fixes
  → File cleanup (delete 7, archive 26)

Backlog: Priority 4 items as time permits
```

---

*Generated from parallel audit on 2026-03-06. Individual audit reports in this folder.*
