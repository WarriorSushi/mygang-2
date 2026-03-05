# Billing Implementation Plan

**Date:** 2026-03-05
**Depends on:** 01-BILLING-DESIGN.md

---

## Implementation Order (11 tasks)

### Task 1: Mandatory signup — remove guest access entirely
This is the FIRST thing to do. Every user must sign up before using the app.

**Landing page (`src/components/landing/landing-page.tsx`):**
- Hero CTA "Assemble Your Gang" -> opens AuthWall (not `/onboarding`)
- Final CTA "Meet your gang in under a minute" -> opens AuthWall
- Top bar "Log in" button stays as-is (already opens AuthWall)
- After auth success -> route to `/onboarding` (no gang) or `/chat` (has gang)

**Onboarding (`src/app/onboarding/page.tsx`):**
- Add auth guard: if no userId after hydration, redirect to `/` (landing)
- Remove `setIsGuest(userId === null)` — user is always authenticated here
- Remove "Log in" buttons inside onboarding (user is already logged in)

**Chat page (`src/app/chat/page.tsx`):**
- Add auth guard: if no userId after hydration, redirect to `/`
- Remove guest-related UI branches

**Route protection (`src/proxy.ts`):**
- Do NOT add /onboarding or /chat to proxy.ts protected routes (proxy uses session cookies which may not be set yet on client-side navigation). Instead use client-side auth guards in the pages.

**Remove guest state from store (`src/stores/chat-store.ts`):**
- Remove `isGuest` field entirely
- Remove `setIsGuest` setter

**Remove guest logic from hooks:**
- `src/hooks/use-chat-api.ts` — remove first-message-triggers-signup block (lines ~458-465), remove `isGuest` usage, remove `pendingBlockedMessageRef`
- `src/hooks/use-autonomous-flow.ts` — remove any guest checks

**Remove guest logic from components:**
- `src/components/orchestrator/auth-manager.tsx` — remove `setIsGuest(true)` from clearAuthState, remove all isGuest references
- `src/components/chat/message-item.tsx` — like button always visible (no guest check)
- `src/components/chat/message-list.tsx` — remove guest state usage
- `src/components/chat/chat-settings.tsx` — remove "Guest mode" display
- `src/components/chat/memory-vault.tsx` — remove guest early-return (memory gating will be tier-based later)
- `src/components/settings/settings-panel.tsx` — remove guest checks

**Remove guest logic from API:**
- `src/app/api/chat/route.ts` — remove guest daily cap (IP-based), remove `is_guest` field from inserts, require user auth (401 if no user)

**Post-auth page (`src/app/post-auth/page.tsx`):**
- Remove `setIsGuest(false)` call (field won't exist)

**Files touched (14):**
1. `src/components/landing/landing-page.tsx`
2. `src/app/onboarding/page.tsx`
3. `src/app/chat/page.tsx`
4. `src/stores/chat-store.ts`
5. `src/hooks/use-chat-api.ts`
6. `src/hooks/use-autonomous-flow.ts`
7. `src/components/orchestrator/auth-manager.tsx`
8. `src/components/chat/message-item.tsx`
9. `src/components/chat/message-list.tsx`
10. `src/components/chat/chat-settings.tsx`
11. `src/components/chat/memory-vault.tsx`
12. `src/components/settings/settings-panel.tsx`
13. `src/app/api/chat/route.ts`
14. `src/app/post-auth/page.tsx`

---

### Task 2: Install packages & add env vars
- `pnpm add dodopayments @dodopayments/nextjs dodopayments-checkout`
- Add DODO_PAYMENTS_* to `.env.example`
- Create `src/lib/billing.ts` with DodoPayments client + tier helpers

### Task 3: Database migration
- Create migration SQL
- Add `subscriptions` table, `billing_events` table
- Add `dodo_customer_id` to profiles
- Add RLS policies
- Apply via Supabase MCP

### Task 4: Update chat API message gating (tier-based)
- Implement tier-based gating in `src/app/api/chat/route.ts`:
  - Free: 20 msgs / 60-min sliding window via Redis, memory disabled
  - Basic: 1000/month, then fallback to free tier rules
  - Pro: unlimited, memory enabled
- Return JSON with `paywall: true` + `cooldown_seconds` when limit hit

### Task 5: Create paywall popup component
- `src/components/billing/paywall-popup.tsx` — Radix Dialog modal
- Countdown timer showing minutes remaining
- Funny/relatable copy about unexpected adoption
- Upgrade CTA (Pro $19.99, ~~$99~~)
- "View All Plans" link to /pricing
- Triggered when chat API returns paywall flag
- Wire into chat page state

### Task 6: Create pricing page
- `src/app/pricing/page.tsx`
- 3 plan cards: Free (current), Basic ($14.99), Pro ($19.99 with ~~$99~~ strikethrough)
- Highlight Pro as recommended with "80% OFF Launch Week" badge
- Auth-aware: show "Current Plan" badge, "Upgrade" buttons
- Checkout button triggers DodoPayments overlay

### Task 7: Create checkout API + success page
- `src/app/api/checkout/route.ts` — POST creates DodoPayments checkout session
- `src/app/checkout/success/page.tsx` — reads return URL params, activates tier immediately via server action, celebration UI, redirect to /chat

### Task 8: Create webhook handler
- `src/app/api/webhook/dodo-payments/route.ts`
- Handle: subscription.active, renewed, cancelled, expired, on_hold
- Handle: payment.succeeded, payment.failed
- Log all events to billing_events table
- Update profiles.subscription_tier (source of truth)

### Task 9: Create customer portal route
- `src/app/api/customer-portal/route.ts`
- Redirects to DodoPayments hosted portal for subscription management

### Task 10: Update settings panel with billing
- Add "Plan & Billing" section to settings panel
- Show current plan, usage stats
- Free users: "Upgrade" button -> /pricing
- Paid users: "Manage Subscription" -> customer portal
- Paid users: "Change Plan" -> /pricing

### Task 11: Final cleanup & tests
- Remove any remaining guest references across codebase
- Update Playwright tests for new auth-required flow
- Verify build passes

---

## Dependencies

```
Task 1 (auth flow) — FIRST, standalone
Task 2 (packages) — standalone
Task 3 (DB) — after Task 2
Task 4 (gating) — after Task 1 + Task 3
Task 5 (paywall popup) — after Task 4
Task 6 (pricing) — after Task 2
Task 7 (checkout) — after Task 6
Task 8 (webhook) — after Task 3
Task 9 (portal) — after Task 2
Task 10 (settings) — after Task 5 + Task 9
Task 11 (cleanup) — after all
```

## Notes
- DODO_PAYMENTS products must be created manually in their dashboard first
- Webhook URL must be registered in DodoPayments dashboard after deployment
- Test mode available for development (no real charges)
- `proxy.ts` handles admin route protection only (NOT middleware.ts — Next.js 16 uses proxy.ts)
- Client-side auth guards used for /onboarding, /chat (avoids SSR cookie timing issues)
