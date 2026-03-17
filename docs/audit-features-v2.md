# MyGang Feature Audit v2 - Product & UX Review

Audited: 2026-03-18
Previous audit: 2026-03-17 (`docs/audit-features.md`)
Scope: Onboarding, notifications, settings, tier enforcement, analytics, moderation, PWA, new features

---

## What Was Fixed From v1

| v1 ID | Issue | Status |
|-------|-------|--------|
| O3 | Squad limit in onboarding ignores paid tier | FIXED - `getSquadLimit(subscriptionTier)` now used dynamically in onboarding `toggleCharacter` |
| S3 | Hardcoded "80% off launch week" with no expiry | FIXED - `LAUNCH_PROMO_END` date constant (2026-06-01) with `isLaunchPromoActive()` gate in both settings-panel.tsx and pricing page |
| S5 | No way to change email/password | FIXED - Full change-email and change-password forms in settings-panel.tsx with Supabase auth, validation, and success/error feedback |
| T1 | Wallpapers/nicknames/vault ungated for free users | FIXED - chat-settings.tsx enforces `subscriptionTier === 'free'` checks with Lock icons, opacity, `cursor-not-allowed`, and `aria-disabled` for ecosystem mode, wallpapers, and nicknames |
| A3 | No conversion tracking | PARTIALLY FIXED - `pricing_page_view` and `checkout_started` events added. Server-side `checkout_completed` logged. Still missing client-side completion event and churn tracking |
| C3 | No message report/flag button | FIXED - Flag icon on AI messages in message-item.tsx with `message_reported` analytics event |
| C4 | Self-harm detection missing crisis resources | FIXED - System prompt includes 988 Lifeline directive + dedicated system message appended after soft-block detection |
| N4/P4 | No PWA install prompt | FIXED - `pwa-install-prompt.tsx` handles `beforeinstallprompt` with install/dismiss UI, localStorage persistence |
| E2 | No inline retry for history sync failure | FIXED - `retryBootstrap` wired to both inline toast action button and MessageList retry. Toast shows "Retry" button when `historyStatus === 'error'` |

---

## 1. Onboarding Flow

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| O1 | **Squad limit now dynamic.** `getSquadLimit(subscriptionTier)` correctly reads from store. Paid users on retake get their tier's limit. | - | Fixed |
| O2 | **No resume after browser close.** State still only persisted on `completeOnboarding`. Mid-onboarding close means restart. | should-have | Open from v1 |
| O3 | **Vibe quiz still has no explanation.** Users don't know why they're answering personality questions. One sentence would reduce confusion. | nice-to-have | Open from v1 |
| O4 | **Loading step still has 3.5s minimum wait.** Minor UX friction on fast connections. | nice-to-have | Open from v1 |

## 2. Notification System

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| N1 | **Push notifications fully implemented.** VAPID, SW push handler, subscription CRUD, settings UI with all states (unsupported, denied, subscribed, default). Well done. | - | Good |
| N2 | **No in-app notification center.** Still no inbox, badge, or feed for users who deny push. Tab presence (title-based unread count) exists but is not a replacement. | should-have | Open from v1 |
| N3 | **No notification granularity.** On/off only, no per-type preferences. | nice-to-have | Open from v1 |

## 3. Settings & Preferences

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| S1 | **Change email implemented.** Sends confirmation via Supabase, good error handling, tracked in analytics. | - | Fixed |
| S2 | **Change password implemented.** 6-char minimum, success/error states, analytics tracked. | - | Fixed |
| S3 | **Launch promo now date-gated.** `isLaunchPromoActive()` checks against `LAUNCH_PROMO_END` (June 1, 2026). Properly gated in both settings upgrade card and pricing page. | - | Fixed |
| S4 | **Upgrade tour card works.** After upgrading from free to paid, `showUpgradeTour` flag triggers a feature discovery card showing Ecosystem Mode, Wallpapers, Nicknames, Memory Vault. Dismissible and persistent in store. | - | Good |
| S5 | **No "current password" confirmation for password change.** The form accepts a new password without verifying the old one. This is a Supabase limitation (session-based auth), but a UX concern for shared devices. | nice-to-have | New |
| S6 | **No email format validation on client.** The email change form has no client-side validation beyond empty check. Invalid emails hit Supabase and return an error, but inline validation would be better UX. | nice-to-have | New |

## 4. Tier System - Enforcement Audit

| Perk | Free | Basic | Pro | Enforced? |
|------|------|-------|-----|-----------|
| Messages per hour | 25 | 40 | Unlimited | YES - rate-limit.ts + chat route |
| Squad size | 4 | 5 | 6 | YES - onboarding, upgrade/downgrade modals |
| Memory saved | 20 max | 50 max | Unlimited | YES - memory.ts |
| Memory in prompt | 0 | 3 | 5 | YES - system-prompt.ts |
| Context messages | 25 | 40 | 50 | YES - history-format.ts |
| Ecosystem mode | No | Yes | Yes | YES - chat route rejects + chat-settings UI locked |
| Chat wallpapers | No | Yes | Yes | YES - chat-settings locks for free with Lock icon + opacity |
| Custom nicknames | No | Yes | Yes | YES - chat-settings locks for free |
| Memory vault access | No | Yes | Yes | PARTIAL - vault opens from chat header regardless of tier; chat-settings shows Lock, but direct vault button in header may bypass |
| Extended responses | No | No | Yes | YES - higher token limits in chat route |
| Pro badge in chat | No | No | Yes | YES - shown in chat-settings tier badge |

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| T1 | **Memory vault header button may bypass tier gate.** The vault is opened from ChatHeader via `onOpenVault` with no tier check. Chat-settings shows the lock, but the brain icon in the header opens it directly. Free users may access the vault UI (even if it's empty). | should-have | New |
| T2 | **"Priority response speed" still marketing-only.** No queue priority or faster model for Pro. Higher token limits exist but that's response length, not speed. | should-have | Open from v1 |

## 5. Analytics & Conversion Tracking

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| A1 | **Conversion funnel partially tracked.** `pricing_page_view` and `checkout_started` events fire on the client. Server logs `checkout_completed` but only to console, not to the analytics_events table. | must-have | Partially fixed |
| A2 | **No client-side checkout success event.** The checkout success page (`/checkout/success`) does not fire a `trackEvent('checkout_completed')`. The webhook logs it server-side but analytics_events table is never updated for this critical event. | must-have | New |
| A3 | **No churn/cancellation tracking.** No events for subscription downgrades, cancellations, or expirations. | should-have | Open from v1 |
| A4 | **No analytics dashboard.** Events accumulate in Supabase with no admin view. The admin panel has overview and users pages but no analytics visualization. | should-have | Open from v1 |
| A5 | **Session duration not tracked.** `session_start` fires but no `session_end` or duration calculation. Can't measure engagement depth. | should-have | Open from v1 |

## 6. Content Moderation & Safety

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| C1 | **Crisis resources now included.** Self-harm detection triggers 988 Lifeline in both the system prompt directive and as an appended system message. | - | Fixed |
| C2 | **Report button added.** Flag icon on AI messages, fires `message_reported` analytics event. Local state only (no server-side report queue or admin review). | - | Fixed (partial) |
| C3 | **No server-side report handling.** The report button tracks an analytics event but there is no dedicated reports table, no admin review queue, and no escalation workflow. For compliance, reported messages should be reviewable. | should-have | New |
| C4 | **No escalating response to repeated unsafe content.** A user sending borderline content repeatedly faces no consequences beyond per-message filtering. | nice-to-have | Open from v1 |

## 7. PWA & Offline

| # | Finding | Priority | Status |
|---|---------|----------|--------|
| P1 | **PWA install prompt added.** `pwa-install-prompt.tsx` intercepts `beforeinstallprompt`, shows a polished bottom banner with Install/Dismiss, persists dismissal in localStorage. | - | Fixed |
| P2 | **Manifest is correct.** Standalone, portrait, proper icons (192 + 512), good start_url. | - | Good |
| P3 | **No app shell caching.** SW only caches `offline.html`. Opening PWA offline shows generic offline page, not cached chat UI. | should-have | Open from v1 |
| P4 | **No offline message queue.** Input disabled when offline. Typed message lost. No background sync. | should-have | Open from v1 |
| P5 | **No maskable icon in manifest.** Only `"purpose": "any"` is set. Android devices may display the icon poorly without a maskable variant. | nice-to-have | New |

## 8. New Features Verification

### Launch Promo Gate
- `isLaunchPromoActive()` with `LAUNCH_PROMO_END = new Date('2026-06-01')` used in both settings-panel.tsx and pricing/page.tsx. Badge reads "80% off -- launch week" when active, falls back to "Upgrade available" when expired. The pricing page conditionally shows the "Save 80%" badge and "Launch pricing" pill. **Working correctly.**

### Message Report
- Flag icon appears on all AI messages (not user messages, not reactions, not system messages). Click sets local `reported` state, disables button, fires `message_reported` analytics event with messageId. Visually changes to amber color when reported. **Working correctly, though server-side handling is absent (see C3).**

### History Retry
- `retryBootstrap` callback in `use-chat-history.ts` resets error state and re-runs bootstrap. Wired to:
  1. InlineToast action button (when `historyStatus === 'error'`)
  2. MessageList `onRetryHistory` prop
- **Working correctly. Both retry paths functional.**

### Retry Failed Messages
- Individual failed messages show "Failed to send" + Retry button in message-item.tsx. The button calls `onRetry` which triggers `handleRetryMessage` in the chat API hook. **Working correctly.**

### Purchase Celebration
- Confetti + character celebration message after successful purchase. Uses sessionStorage (fast path) + DB flag (fallback). Clears flag after triggering. **Working correctly.**

---

## 9. Remaining Gaps for Production

### Must-Have (ship blockers)
1. **A2** - Client-side `checkout_completed` event not firing on success page. Server-side only logs to console. Analytics table has no conversion data.

### Should-Have (next sprint)
1. **O2** - Resume onboarding after browser close (drop-off risk)
2. **N2** - In-app notification center / missed message feed
3. **T1** - Memory vault accessible from header without tier check
4. **T2** - Reword "priority response speed" or implement actual queue priority
5. **A3** - Churn/cancellation tracking events
6. **A4** - Analytics dashboard for admin
7. **A5** - Session duration tracking
8. **C3** - Server-side report queue with admin review
9. **P3** - App shell caching for offline PWA experience
10. **P4** - Offline message queue with background sync
11. **SO1** - Social sharing (share-to-social, squad cards) - open from v1
12. **SO3** - Referral system - open from v1

### Nice-to-Have
1. O3 (vibe quiz explanation), O4 (loading step speed), N3 (notification granularity), S5 (current password confirm), S6 (email validation), C4 (escalating moderation), P5 (maskable icon)

### Future
1. i18n, sound/haptic settings, user profiles/public pages

---

## Summary

Significant progress since v1. **9 of the original must-have and should-have items are now fixed**, including the most critical ones: squad tier limits, promo date gating, paid feature enforcement, crisis resources, report button, PWA install prompt, email/password changes, history retry, and conversion tracking (partial).

The **single remaining must-have** is completing conversion tracking by firing a client-side `checkout_completed` event on the success page and writing it to the analytics table.

The app is substantially closer to production-ready. The main gaps are now in the analytics/data layer (can't measure what you can't see), offline resilience, and growth features (sharing, referrals). These are important for scaling but not launch-blocking.
