# MyGang Feature Audit - Product & UX Gaps

Audited: 2026-03-17
Scope: All pages, components, stores, API routes, billing, PWA, analytics, safety

---

## 1. Onboarding Flow

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| O1 | **No email verification nudge.** Users sign up and land in onboarding with no confirmation that email is verified. If Supabase email confirm is on, a stale unverified session could cause silent failures later. | should-have | S | Medium - trust & deliverability |
| O2 | **No skip/resume onboarding.** If a user closes the browser mid-onboarding (e.g., at vibe quiz), there is no saved progress. They restart from WELCOME every time. State is only persisted on final `completeOnboarding` call. | should-have | M | High - drop-off risk |
| O3 | **Squad limit hardcoded to 4 in onboarding toggle.** `toggleCharacter` caps at 4 regardless of tier. A paid user doing retake should get their tier's squad limit (5 or 6). | must-have | S | Medium - paid users get wrong limit |
| O4 | **No tooltip/explanation of what the vibe quiz does.** Users answer personality questions but are never told why or how it affects their experience. A single sentence would help. | nice-to-have | S | Low |
| O5 | **Loading step has a fixed 3.5s minimum wait** (`setTimeout(resolve, 3500)`) even if the server call completes instantly. Feels sluggish on fast connections. | nice-to-have | S | Low |

## 2. Notification System

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| N1 | **Push notifications exist and work.** VAPID keys, service worker push handler, subscription management UI in settings, server-side `sendToUser` with stale cleanup - all present. Solid implementation. | - | - | - |
| N2 | **No in-app notification center.** Push works when the user is away, but there is no in-app notification feed, badge count, or history of missed notifications. Users who deny push permissions have no fallback. | should-have | L | High - engagement |
| N3 | **No notification preferences granularity.** Users can only toggle push on/off entirely. No way to choose notification types (e.g., WYWA teasers yes, promotional no). | nice-to-have | M | Low |
| N4 | **No "install app" prompt for PWA.** The manifest.json is present and correct, but there is no UI prompting users to add the app to their home screen (`beforeinstallprompt` event is not handled). | should-have | S | Medium - retention |

## 3. Settings & Preferences

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| S1 | **No language/locale setting.** App is English-only with no i18n infrastructure. Fine for launch, but worth noting. | future | L | Low for now |
| S2 | **No sound/haptic toggle.** No audio settings exist. If sounds are ever added, the toggle should be in place. | future | S | Low |
| S3 | **"80% off - launch week" badge is hardcoded** in the free tier upgrade card in settings-panel.tsx. There is no expiry date or feature flag. This will become stale and misleading after launch week ends. | must-have | S | High - trust erosion |
| S4 | **Chat settings panel (in-chat sheet) duplicates some settings-page functions** (delete account, sign out) but not others (delete memories, start fresh). Inconsistent surface area. | nice-to-have | S | Low |
| S5 | **No way to change email or password** from within the app. Users would need to go through Supabase auth flows directly. | should-have | M | Medium |

## 4. Broken or Incomplete Features

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| B1 | **`lowCostMode` still exists in store and chat API** but was reportedly "removed" from settings UI. The toggle was removed from settings-panel.tsx but the mode is still active in the backend via `autoLowCostMode` capacity manager and persisted in profiles. Orphaned setting that users cannot control. | should-have | S | Low - auto mode works, but manual toggle gone |
| B2 | **Chat wallpapers and custom nicknames are listed as paid features on pricing page** but there is no lock/gate in the chat-settings UI that explicitly blocks free users. The pricing page says "false" for free tier, but enforcement needs verification in the chat-settings component. | must-have | M | High - revenue leakage if ungated |
| B3 | **Screenshot feature uses `html-to-image`** which is known to have issues with CSS gradients, custom fonts, and backdrop-filter on some browsers. No fallback or user warning. | nice-to-have | M | Low |
| B4 | **`offline.html` exists but no offline message queue.** When offline, input is disabled with a banner. Messages are not queued for retry when connection returns. User loses their typed message intent. | should-have | M | Medium |

## 5. Tier System - Enforcement Audit

| Perk | Free | Basic | Pro | Enforced? |
|------|------|-------|-----|-----------|
| Messages per hour | 25 | 40 | Unlimited | YES - rate-limit.ts + chat route |
| Squad size | 4 | 5 | 6 | YES - onboarding + upgrade/downgrade modals |
| Memory saved | Yes (20 max) | Yes (50 max) | Unlimited | YES - memory.ts checks |
| Memory in prompt | 0 | 3 | 5 | YES - system-prompt.ts |
| Context messages | 25 | 40 | 50 | YES - history-format.ts |
| Ecosystem mode | No | Yes | Yes | YES - chat route rejects free ecosystem |
| Chat wallpapers | No | Yes | Yes | **NEEDS VERIFICATION** |
| Custom nicknames | No | Yes | Yes | **NEEDS VERIFICATION** |
| Memory vault access | No | Yes | Yes | **NEEDS VERIFICATION** |
| Priority response speed | No | No | Yes | PARTIAL - different token limits per tier, but no actual queue priority |

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| T1 | **Wallpapers, nicknames, and memory vault gating unclear.** Pricing page lists these as paid-only, but the chat-settings component needs explicit tier checks to block free users from accessing these panels. | must-have | S | High - feature leakage |
| T2 | **"Priority response speed" is marketing-only.** Pro gets higher token limits and split chances, but there is no actual request queue priority or faster model routing. The claim is borderline misleading. | should-have | S | Medium - expectation mismatch |
| T3 | **Ecosystem mode free-tier first-3-messages allowance** mentioned in MEMORY.md but not visible in pricing or UI copy. Undocumented partial access. | nice-to-have | S | Low |

## 6. Analytics Tracking

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| A1 | **Basic analytics exists.** Client-side `trackEvent` sends to `/api/analytics` which writes to `analytics_events` table. Events tracked: session_start, onboarding flow, avatar selections, delete actions, vibe retake. | - | - | - |
| A2 | **No analytics dashboard or reporting.** Events are stored in Supabase but there is no admin page to view them, no charts, no funnel visualization. Data goes in but nobody looks at it. | should-have | L | High - flying blind on product decisions |
| A3 | **No conversion tracking.** No events for: pricing page view, checkout started, checkout completed, subscription changed, churn. Critical for understanding monetization funnel. | must-have | M | High - can't optimize revenue |
| A4 | **No retention/engagement metrics.** No DAU/WAU tracking, no session duration, no messages-per-session, no feature usage heatmap. | should-have | M | High - can't measure product-market fit |
| A5 | **No third-party analytics (GA4, Mixpanel, PostHog, etc.).** Everything is first-party only. Good for privacy, but limited capabilities. | nice-to-have | M | Medium |

## 7. Social Features

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| SO1 | **No sharing beyond screenshots.** The screenshot/download feature exists but there is no share-to-social, no shareable links, no "share your squad" cards. | should-have | M | High - viral growth |
| SO2 | **No user profiles or public pages.** Users have no public identity, no profile page, no way to see other users' squads. | future | L | Medium |
| SO3 | **No referral system.** No invite codes, no "invite a friend" flow, no referral rewards. | should-have | M | High - growth |

## 8. Error Recovery

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| E1 | **Error boundaries exist at multiple levels.** Global error boundary (Sentry), chat error boundary, per-page error.tsx files. Good coverage. | - | - | - |
| E2 | **Chat history sync failure shows toast but no retry button.** `historyStatus === 'error'` shows "Could not load chat history. Try refreshing." but no inline retry action. User must manually refresh. | should-have | S | Medium |
| E3 | **Post-auth page has good timeout recovery.** Shows retry/reload buttons after 8s timeout. Well implemented. | - | - | - |
| E4 | **Message delivery failures visible but no bulk retry.** Individual messages show `failed` status with retry, but if multiple fail (e.g., network blip), user must retry each one individually. | nice-to-have | M | Low |

## 9. Offline / PWA Support

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| P1 | **PWA manifest is present and correct.** Standalone display, proper icons, portrait orientation. App is installable. | - | - | - |
| P2 | **Service worker provides basic offline fallback.** Navigation requests fall back to cached `offline.html`. Non-navigation requests are not cached. | - | - | - |
| P3 | **No offline caching of app shell or assets.** Only `offline.html` is precached. The actual app bundle, CSS, images are not cached. Opening the PWA offline shows a generic offline page, not a cached version of the chat. | should-have | M | High for PWA users |
| P4 | **No "install app" prompt UI.** See N4 above. | should-have | S | Medium |

## 10. Content Moderation & Safety

| # | Finding | Priority | Complexity | Impact |
|---|---------|----------|------------|--------|
| C1 | **Input-side safety filtering exists.** `detectUnsafeContent` checks user messages for hard-block (CSAM, sexual assault) and soft-block (self-harm) patterns with Unicode normalization and leet-speak detection. | - | - | - |
| C2 | **Output-side safety filtering exists.** AI responses are also checked through `detectUnsafeContent`. | - | - | - |
| C3 | **No user-facing reporting mechanism.** If a user sees an inappropriate AI response, there is no "report" or "flag" button on messages. | should-have | S | Medium - trust & compliance |
| C4 | **Soft-block patterns (self-harm) unclear on user-facing response.** The code detects these but it's unclear if the response includes crisis resources (hotline numbers, etc.). | must-have | S | High - liability |
| C5 | **No rate limiting on message content patterns.** A user repeatedly sending borderline content that passes filters has no escalating response (temporary ban, warning count). | nice-to-have | M | Low |

---

## Summary by Priority

### Must-Have (ship blockers)
1. **O3** - Squad limit in onboarding ignores paid tier limits
2. **S3** - Hardcoded "80% off launch week" will become stale
3. **T1** - Wallpapers/nicknames/vault may not be gated for free users
4. **A3** - No conversion/checkout analytics
5. **C4** - Self-harm detection should surface crisis resources

### Should-Have (next sprint)
1. **O2** - Resume onboarding after browser close
2. **N2** - In-app notification center
3. **N4/P4** - PWA install prompt
4. **B2** - Verify and enforce paid feature gates
5. **B4** - Offline message queue
6. **S5** - Change email/password in-app
7. **A2** - Analytics dashboard in admin
8. **A4** - Retention metrics
9. **SO1** - Social sharing cards
10. **SO3** - Referral system
11. **E2** - Inline retry for history sync failure
12. **P3** - App shell caching for PWA
13. **C3** - Message report/flag button
14. **T2** - Reword "priority response speed" or implement it

### Nice-to-Have
1. O4, O5, N3, S4, B1, B3, T3, A5, E4, C5

### Future
1. S1 (i18n), S2 (sounds), SO2 (profiles)
