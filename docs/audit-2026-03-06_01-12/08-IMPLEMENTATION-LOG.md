# Implementation Log — Audit Fixes 2026-03-06

## Priority 1: CRITICAL (All Fixed)

### 1.1 Customer Portal Auth Bypass - FIXED
- **File:** `src/app/api/customer-portal/route.ts`
- **Change:** Removed the `customer_id` query param bypass. Now always requires auth and uses the authenticated user's own customer_id.

### 1.2 Subscription Activation Ownership Check - FIXED
- **File:** `src/app/api/checkout/activate/route.ts`
- **Change:** Added ownership verification — checks that the subscription's `customer_id` matches the authenticated user's `dodo_customer_id` before activating.

### 1.3 Rate Limiting Singleton Cache - FIXED
- **File:** `src/lib/rate-limit.ts`
- **Change:** Cached Redis and Ratelimit instances at module level instead of re-instantiating per request. Saves ~60-150ms per call.

## Priority 2: HIGH (All Fixed)

### 2.1 Webhook Orphan Logging - FIXED
- **File:** `src/app/api/webhook/dodo-payments/route.ts`
- **Change:** All 4 webhook handlers now log critical errors and create `*.orphaned` billing events when no user is found for a customer_id, instead of silently returning.

### 2.2 Pricing Page Message Limit Mismatch - FIXED
- **File:** `src/app/pricing/page.tsx`
- **Change:** Changed "1,000 messages per month" to "500 messages per month" to match the billing code limit.

### 2.3 Stale Closure in Debounced Send - FIXED
- **File:** `src/hooks/use-chat-api.ts`
- **Change:** `scheduleDebouncedSend` now calls `sendToApiRef.current` instead of the stale `sendToApi` closure.

### 2.4 Avatar Compression - FIXED
- **Files:** `public/avatars/*.png` (14 files)
- **Change:** Resized from full-res (~7-8MB each, 106MB total) to 512x512 PNG (~120-177KB each, ~2MB total). 98% size reduction.

### 2.5 Plaintext Admin Password Removed - FIXED
- **File:** `src/lib/admin/auth.ts`
- **Change:** Removed `'plain'` config mode entirely. Admin auth now requires hash-only (`ADMIN_PANEL_PASSWORD_HASH`).

## Priority 3: MEDIUM (All Fixed)

### 3.1 Purchase Celebration Reliability - FIXED
- **Files:** `src/app/chat/page.tsx`, `src/app/api/webhook/dodo-payments/route.ts`
- **DB Migration:** Added `purchase_celebration_pending` column to profiles table
- **Change:** Dual detection — sessionStorage (fast path) + DB flag (reliable fallback for tab closure). Webhook sets DB flag on subscription activation. Chat page clears flag after triggering celebration.

### 3.2 Low-Cost Mode Bypass for Celebrations - FIXED
- **File:** `src/hooks/use-chat-api.ts`
- **Change:** Added `purchaseCelebration` exception to the low-cost mode autonomous call blocker.

### 3.3 Missing Character Greetings - FIXED
- **File:** `src/constants/character-greetings.ts`
- **Change:** Added greetings for Sage, Miko, Dash, Zara, Jinx, and Nova (6 characters, 3 greetings each).

### 3.4 User Message Truncation Limit Increased - FIXED
- **File:** `src/app/api/chat/route.ts`
- **Change:** Increased `MAX_LLM_MESSAGE_CHARS` from 500 to 1000 to better respect user input length.

### 3.7 Empty Chat Suggestion Chips - FIXED
- **Files:** `src/components/chat/message-list.tsx`, `src/app/chat/page.tsx`
- **Change:** Added suggestion chips ("What's good?", "I need advice", "Roast me", "Tell me something wild") to the empty chat state. Wired up `onSendSuggestion` callback.

### 3.8 Paywall Shows Both Plans - FIXED
- **File:** `src/components/billing/paywall-popup.tsx`
- **Change:** Added a Basic tier CTA button ($14.99/mo) below the Pro CTA, replacing the generic "View all plans" link.

## File Cleanup (Done)

### Deleted (7 files)
- `src/components/ui/scroll-area.tsx` (unused)
- `src/components/ui/badge.tsx` (unused)
- `src/components/ui/tabs.tsx` (unused)
- `src/components/ui/label.tsx` (unused)
- `src/components/ui/textarea.tsx` (unused)
- `src/components/ui/card.tsx` (unused)
- `public/logo.webp` (unused, logo.png is used)

### Database
- Migration: `add_purchase_celebration_pending` — added `purchase_celebration_pending boolean DEFAULT false` to profiles

## Type Updates
- `src/lib/database.types.ts` — Added `purchase_celebration_pending` to Row, Insert, and Update types for profiles

## Verification
- TypeScript: `pnpm tsc --noEmit` passes cleanly
- Build: `pnpm build` succeeds with no errors

## Priority 4: LOW (Implemented)

### UI/UX Improvements

- **Message actions on hover (desktop):** `src/components/chat/message-item.tsx` — Added mouseEnter/mouseLeave handlers with 200ms debounce for desktop hover-based action display.
- **Pricing table mobile fix:** `src/app/pricing/page.tsx` — Added `overflow-x-auto` wrapper with `min-w-[420px]` inner div to prevent table squishing on mobile.
- **Post-auth slow loading hint:** `src/app/post-auth/page.tsx` — Shows "Taking longer than expected" message after 4 seconds.
- **Auth wall copy improvement:** `src/components/orchestrator/auth-wall.tsx` — Changed to "Join the gang" title, friendlier description, added password hint.
- **Onboarding loading back-nav fix:** `src/app/onboarding/page.tsx` — Changed `router.push` to `router.replace` to prevent back-navigation to loading step.
- **Resume banner timing:** `src/app/chat/page.tsx` — Slowed auto-dismiss from 4s to 6s.
- **Inline typing indicator:** `src/components/chat/message-list.tsx` — Added typing indicator with character avatars and animated dots at bottom of message list.
- **Unread count badge:** `src/components/chat/message-list.tsx` — Scroll-to-bottom button now shows unread message count when user has scrolled up.

### Performance

- **Content-visibility on messages:** `src/components/chat/message-list.tsx` — Off-screen messages (index < length - 6) get `content-auto` CSS class.
- **Image cache TTL:** `next.config.ts` — Increased `minimumCacheTTL` from 60 to 3600.
- **Grain overlay conditional:** `src/components/holographic/background-blobs.tsx` — Only renders grain overlay on non-low-end devices.

### Already Handled / N/A
- Character card click target conflict: Already fixed with `e.stopPropagation()` on "More" button.
- Parallax reduced-motion: No parallax effect exists. `prefers-reduced-motion` already disables animations.
- Theme toggle consolidation: 4 locations are contextually appropriate (landing, chat header, settings, auth).
- Radix-UI package split: Deferred — umbrella package is fine for current app size.
- Streaming: Major feature — deferred to dedicated sprint.
- Long conversation context management: Major feature — deferred to dedicated sprint.

## Verification
- TypeScript: `pnpm tsc --noEmit` passes cleanly
- Build: `pnpm build` succeeds with no errors
