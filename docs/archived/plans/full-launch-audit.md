# MyGang Full Launch Audit

**Date:** 2026-03-08
**Audited by:** 5 parallel agents covering CSS/Visual, Security, User Flows, Database/Performance, SEO/Accessibility/Billing/Chat
**Scope:** Every source file, migration, API route, component, hook, and store
**Previous audit (v3):** 51 items fixed -- none re-reported here

---

## Summary
- **1 critical** (must fix before launch)
- **26 important** (should fix before launch)
- **24 nice-to-have** (can fix post-launch)

---

## Critical

### [BILLING-C1] Ecosystem chat mode not server-side gated for free tier
- **File:** `src/app/api/chat/route.ts`
- **What's wrong:** The pricing page shows "Ecosystem chat mode" as a Basic/Pro feature, but the chat API accepts `chatMode: 'ecosystem'` from any tier without validation. A free user can call the API directly with `chatMode: 'ecosystem'` and use ecosystem features without paying.
- **Impact:** Free-tier users can bypass the paywall and access a paid feature via direct API calls. Revenue leakage.
- **Fix:** Add server-side tier validation after determining the user's tier:
  ```ts
  if (chatMode === 'ecosystem' && tier === 'free') {
    return NextResponse.json({ error: 'Ecosystem mode requires Basic or Pro' }, { status: 403 })
  }
  ```
- **Benefit:** Stops free users from getting paid features for free. Protects your revenue.

---

## Important

### Visual / UI

### [VIS-I1] Missing `geistMono.variable` on body -- mono font never applied
- **File:** `src/app/layout.tsx:106`
- **What's wrong:** `Geist_Mono` font is imported and downloaded (~20-40KB), but `${geistMono.variable}` is not added to the body className. The CSS variable `--font-geist-mono` is referenced in `globals.css` but never injected, so `font-mono` falls back to system monospace.
- **Impact:** Wasted bandwidth on every page load + mono text uses system font instead of Geist Mono.
- **Fix:** Change line 106 to: `className={\`${geistSans.variable} ${geistMono.variable} ${outfit.variable} antialiased\`}`
- **Benefit:** Mono text looks correct, and the font download actually serves a purpose.

### [VIS-I2] Upgrade-picker-modal z-50 conflicts with Sheet/Dialog overlays
- **File:** `src/components/squad/upgrade-picker-modal.tsx:117`
- **What's wrong:** Uses `z-50`, same as Sheet and Dialog. If opened while another overlay is visible, they fight for stacking order. The downgrade-keeper-modal correctly uses `z-[100]`.
- **Impact:** Upgrade picker could render behind the settings sheet.
- **Fix:** Change `z-50` to `z-[100]` to match downgrade-keeper-modal.
- **Benefit:** Upgrade picker always shows on top of other overlays.

### [VIS-I3] Pricing page has large inline style block with hardcoded colors
- **File:** `src/app/pricing/page.tsx:524-598`
- **What's wrong:** Inline `<style>` block with hardcoded hex/rgba colors for gradient borders and conic-gradients. Bypasses the theme system entirely.
- **Impact:** These decorative effects won't adapt to theme changes and are harder to maintain.
- **Fix:** Move gradient styles to `globals.css` using CSS custom properties with light/dark variants.
- **Benefit:** Pricing page decorations respect the theme system and are easier to update.

### [VIS-I4] Chat settings component has 30+ inline styles with hardcoded colors
- **File:** `src/components/chat/chat-settings.tsx` (throughout)
- **What's wrong:** Extensive inline styles with hardcoded rgba/hex values for wallpaper previews, gradients, and UI elements. Bypasses Tailwind and the theme system.
- **Impact:** Difficult to maintain, won't adapt to theme changes.
- **Fix:** Define CSS classes in globals.css for wallpaper previews and teal gradients.
- **Benefit:** Cleaner code, theme-consistent styling.

### Security

### [SEC-I1] Server actions missing rate limiting (deleteAllMessages, deleteAllMemories)
- **File:** `src/app/auth/actions.ts:445-479`
- **What's wrong:** `deleteAllMessages()` and `deleteAllMemories()` authenticate the user but have no rate limiting. `deleteAccount` correctly has rate limiting, but these bulk-delete actions don't.
- **Impact:** A malicious user could spam bulk delete calls, causing database strain.
- **Fix:** Add `rateLimit('delete-all-messages:' + user.id, 3, 60_000)` before the operation.
- **Benefit:** Prevents someone from hammering your database with delete requests.

### [SEC-I2] Server actions missing rate limiting (saveGang, saveUsername, memory operations)
- **File:** `src/app/auth/actions.ts:145, 230, 269, 283, 481`
- **What's wrong:** `saveGang`, `saveUsername`, `deleteMemory`, `updateMemory`, and `saveMemoryManual` have no rate limiting. The memory operations call `generateEmbedding` (external API), so unlimited calls could exhaust embedding API quota.
- **Impact:** Authenticated users could cause excessive DB load and burn through embedding API credits.
- **Fix:** Add `rateLimit()` to each function (e.g., 10 calls per 60 seconds).
- **Benefit:** Protects your database and embedding API from abuse.

### [SEC-I3] signInOrSignUpWithPassword has no app-level rate limiting
- **File:** `src/app/auth/actions.ts:66`
- **What's wrong:** Relies solely on Supabase's built-in auth rate limiting. No app-layer throttle for credential stuffing or brute-force attacks.
- **Impact:** Faster brute-force attacks than Supabase alone would block.
- **Fix:** Add `rateLimit('auth-login:' + email.toLowerCase(), 10, 60_000)`.
- **Benefit:** Extra layer of protection against password guessing attacks.

### [SEC-I4] persistUserJourney uses unvalidated input in .not() filter
- **File:** `src/lib/supabase/client-journey.ts:118`
- **What's wrong:** `gangIds` from callers are interpolated into a PostgREST `.not()` filter string without validation against known character IDs. The server-side `saveGang` properly validates, but this client-side path doesn't.
- **Impact:** A malicious client could manipulate the filter to delete or retain unexpected gang members (limited to their own data by RLS).
- **Fix:** Validate `gangIds` against `CHARACTERS.map(c => c.id)` before using them in the filter.
- **Benefit:** Prevents unexpected gang member manipulation from crafted client requests.

### User Flows

### [UF-I1] Chat settings Sign Out has no loading state or error handling
- **File:** `src/components/chat/chat-settings.tsx:698-706`
- **What's wrong:** The Sign Out button clears the store then calls `signOut()`, but has no loading state, no try/catch, no disabled state. If sign-out fails (network error), the store is already cleared but the user is still authenticated -- they see a blank state.
- **Impact:** On failure, user sees empty app but is still logged in. Refreshing restores session with no local data.
- **Fix:** Add `isSigningOut` state, wrap in try/catch, and only clear store after `signOut()` succeeds.
- **Benefit:** Sign out either works completely or shows an error -- no confusing half-states.

### [UF-I2] Cooldown timer lost on page refresh
- **File:** `src/app/chat/page.tsx:100`
- **What's wrong:** `cooldownUntil` is React state (not persisted). If a free user gets rate-limited, refreshes the page, the cooldown UI disappears. The server still enforces the limit, so sending a message triggers another paywall popup -- frustrating loop.
- **Impact:** Users on free tier who refresh during cooldown will repeatedly hit the paywall.
- **Fix:** Persist `cooldownUntil` timestamp to `sessionStorage` and restore it on mount.
- **Benefit:** Cooldown countdown survives page refresh, so users know they need to wait.

### [UF-I3] Delete Account in chat-settings uses weak native confirm()
- **File:** `src/components/chat/chat-settings.tsx:361`
- **What's wrong:** Account deletion uses `window.confirm()` instead of the custom two-step confirmation flow used in the full settings panel. Account deletion is irreversible.
- **Impact:** Weaker confirmation for a destructive, irreversible action. Inconsistent UX.
- **Fix:** Use a custom modal matching the pattern in `settings-panel.tsx`.
- **Benefit:** Consistent, safe confirmation flow for account deletion everywhere.

### [UF-I4] Session expiry during chat shows unhelpful error
- **File:** `src/hooks/use-chat-api.ts:284-292`
- **What's wrong:** When the auth session expires (JWT timeout), the API returns 401. The client doesn't distinguish 401 from other errors -- it shows "Quick hiccup on our side. Please try again." The user has no idea their session expired.
- **Impact:** Users in long sessions get confusing errors instead of being prompted to sign in again.
- **Fix:** Check for 401 status and show "Session expired, please sign in again" with a link to `/`.
- **Benefit:** Users know exactly what happened and how to fix it.

### [UF-I5] Checkout success polling continues after component unmount
- **File:** `src/app/checkout/success/page.tsx:50-101`
- **What's wrong:** The `pollActivation` while-loop has no cancellation mechanism. If the user navigates away before 45s timeout, the loop continues making API calls in the background. Could call `setStatus` on unmounted component.
- **Impact:** Wasted API calls and potential React state-update-on-unmounted warnings.
- **Fix:** Add a `cancelled` ref flag set in the useEffect cleanup, check it in the while loop.
- **Benefit:** Clean resource management -- no zombie polling after leaving the page.

### [UF-I6] Checkout success uses router.push instead of router.replace
- **File:** `src/app/checkout/success/page.tsx:47, 148, 170`
- **What's wrong:** Uses `router.push('/chat')` which adds the checkout success page to browser history. Back button from chat goes to a stale checkout success page that re-polls.
- **Impact:** Confusing back-button behavior after successful purchase.
- **Fix:** Change to `router.replace('/chat')`.
- **Benefit:** Back button from chat goes where users expect, not back to a stale checkout page.

### [UF-I7] Ecosystem chatMode not reset when user downgrades to free tier
- **File:** `src/stores/chat-store.ts:159`, `src/components/orchestrator/auth-manager.tsx:56-58`
- **What's wrong:** When a user downgrades from Basic/Pro to Free, `chatMode: 'ecosystem'` persists in localStorage. The UI hides the toggle for free users, but the mode stays active. The autonomous flow will attempt ecosystem API calls.
- **Impact:** Downgraded users continue using ecosystem features until they manually change the mode.
- **Fix:** In `AuthManager.syncProfileState`, reset `chatMode` to `'gang_focus'` when tier is `'free'`.
- **Benefit:** Downgraded users automatically switch to the correct free-tier mode.

### [UF-I8] Chat draft leaks across user sign-outs (privacy issue)
- **File:** `src/components/chat/chat-input.tsx:23, 39, 49, 74`
- **What's wrong:** The chat draft is stored under `mygang-chat-draft` in localStorage. Sign-out clears the Zustand store but never removes this key. A different user signing in on the same device sees the previous user's draft.
- **Impact:** Privacy leak on shared devices. One user sees another's unsent message.
- **Fix:** Clear `localStorage.removeItem('mygang-chat-draft')` during sign-out.
- **Benefit:** Users' unsent messages stay private, even on shared devices.

### [UF-I9] _messageIdSet not synced across tabs
- **File:** `src/stores/chat-store.ts:76-80`
- **What's wrong:** `_messageIdSet` is a module-level Set for O(1) dedup. Zustand persist uses localStorage, but the Set is not synced across tabs. Two tabs open can have diverged dedup sets.
- **Impact:** Two-tab usage can cause duplicate messages.
- **Fix:** Accept this as low-priority since `syncLatestHistory` reconciles from server on visibility change, or add a BroadcastChannel listener.
- **Benefit:** Multi-tab usage doesn't produce duplicate messages.

### SEO

### [SEO-I1] Pricing page missing server-side metadata
- **File:** `src/app/pricing/page.tsx:1`
- **What's wrong:** The pricing page is a `'use client'` component with no `export const metadata`. No page-specific title, description, or canonical URL for search engines.
- **Impact:** Pricing page shows generic title in Google results. Bad for SEO on a key conversion page.
- **Fix:** Create `src/app/pricing/layout.tsx` that exports metadata with title, description, and canonical.
- **Benefit:** Google shows "MyGang.ai Pricing" with a proper description instead of a generic title.

### [SEO-I2] OpenGraph image is 512x512 app icon, not proper 1200x630
- **File:** `src/app/layout.tsx:57-62`
- **What's wrong:** OG image is `/icon-512.png` (square). Twitter card is set to `summary_large_image` which expects 1200x630 landscape. Social shares look bad.
- **Impact:** Poor appearance when shared on Twitter, Facebook, Discord, Slack.
- **Fix:** Create a 1200x630 OG image with MyGang.ai branding and update metadata.
- **Benefit:** Social shares look professional and attractive -- drives more click-throughs.

### Accessibility

### [A11Y-I1] About/Privacy/Terms pages missing id="main-content" for skip link
- **Files:** `src/app/about/page.tsx:38`, `src/app/privacy/page.tsx:16`, `src/app/terms/page.tsx:41`
- **What's wrong:** The layout has a skip link targeting `#main-content`, but these pages' `<main>` elements don't have that id. Skip link does nothing.
- **Impact:** Keyboard users can't skip navigation on these pages (WCAG 2.4.1).
- **Fix:** Add `id="main-content"` to each `<main>` element.
- **Benefit:** Keyboard users can skip straight to content on every page.

### [A11Y-I2] Avatar lightbox in message-item has no focus trap
- **File:** `src/components/chat/message-item.tsx:449-493`
- **What's wrong:** The avatar lightbox overlay has `role="dialog"` and handles Escape, but Tab can move focus behind the overlay.
- **Impact:** Focus escapes the modal, confusing keyboard users (WCAG 2.4.3).
- **Fix:** Add a Tab key handler that constrains focus within the lightbox.
- **Benefit:** Keyboard users stay inside the lightbox until they dismiss it.

### [A11Y-I3] Typing indicator not announced to screen readers
- **File:** `src/components/chat/message-list.tsx:378-405`
- **What's wrong:** Typing indicator (bouncing dots + avatars) is purely visual. No `role="status"` or `aria-live` region.
- **Impact:** Screen reader users don't know AI characters are composing a response (WCAG 4.1.3).
- **Fix:** Add `role="status"` and `aria-label` to the typing indicator wrapper.
- **Benefit:** Screen reader users hear "Kai, Luna typing" while waiting for responses.

### [A11Y-I4] Pricing comparison table boolean values have no accessible text
- **File:** `src/app/pricing/page.tsx:71-87`
- **What's wrong:** Check/X icons for feature values have no accessible text. Screen readers read these cells as empty.
- **Impact:** Comparison table is meaningless to screen reader users (WCAG 1.1.1).
- **Fix:** Add `role="img" aria-label="Included"` / `aria-label="Not included"` to the icon spans.
- **Benefit:** Screen reader users can actually compare plans.

### Billing

### [BILL-I1] Payment failure webhook doesn't trigger tier change
- **File:** `src/app/api/webhook/dodo-payments/route.ts:280-285`
- **What's wrong:** `onPaymentFailed` only logs the event -- doesn't change subscription status or tier. Relies on DodoPayments sending `subscription.cancelled` or `subscription.expired` webhook later. If those webhooks fail, user keeps paid features.
- **Impact:** Potential revenue leakage if DodoPayments doesn't reliably send cancellation webhooks.
- **Fix:** Consider adding a periodic cron or checking for `payment.failed` events during tier lookup.
- **Benefit:** Users who stop paying lose access to paid features reliably.

### Database / Performance

### [PERF-I1] Sequential match_memories calls in semantic deduplication
- **File:** `src/lib/ai/memory.ts:281-298`
- **What's wrong:** Semantic dedup calls `supabase.rpc('match_memories')` sequentially for each new memory. 4 memories = 4 sequential DB round-trips.
- **Impact:** Adds 300-600ms to memory storage on every AI response.
- **Fix:** Parallelize with `Promise.all()`.
- **Benefit:** Memory storage is 300-600ms faster on every message.

### [PERF-I2] Missing index for speaker-filtered chat history queries
- **File:** `src/app/api/chat/route.ts:1479-1484`
- **What's wrong:** Query filters by `user_id + gang_id + speaker = 'user'` but existing index is only on `(user_id, gang_id, created_at)`. The `speaker` filter requires scanning filtered rows.
- **Impact:** Slow for users with thousands of messages (10-50ms extra per request).
- **Fix:** `CREATE INDEX idx_chat_history_user_gang_speaker_created ON chat_history(user_id, gang_id, speaker, created_at DESC);`
- **Benefit:** Chat API responds faster for active users with lots of history.

### [DB-I1] handle_new_user() trigger has no error handling
- **File:** `supabase/migrations/20260203190126_initial_schema.sql:88-98`
- **What's wrong:** The SECURITY DEFINER trigger inserts into profiles but has no EXCEPTION handling. If the insert fails (constraint violation, race condition), the entire auth.users insert rolls back -- user can't sign up.
- **Impact:** Users could silently fail to create an account.
- **Fix:** Add `EXCEPTION WHEN unique_violation THEN NULL` inside the function.
- **Benefit:** Sign-up never fails due to a profile insert edge case.

### [DB-I2] No CHECK constraint on memories.importance
- **File:** `supabase/migrations/20260206220000_add_memory_state.sql:14`
- **What's wrong:** `importance INTEGER DEFAULT 1` accepts any integer. Code uses 1-3, but negative or huge values could skew memory ranking.
- **Impact:** Corrupted importance values pollute memory scoring.
- **Fix:** `ALTER TABLE memories ADD CONSTRAINT memories_importance_range CHECK (importance >= 0 AND importance <= 10);`
- **Benefit:** Memory ranking always uses valid importance values.

---

## Nice-to-Have

### Visual

### [VIS-N1] Dark mode chat chrome borders use hardcoded rgba
- **File:** `src/app/globals.css:349,353`
- **Fix:** Replace with `border-color: var(--border)` or Tailwind border utility.

### [VIS-N2] Destructive button variant uses text-white instead of theme token
- **File:** `src/components/ui/button.tsx`
- **Fix:** Replace `text-white` with `text-destructive-foreground`.

### [VIS-N3] Glass card uses hardcoded white in dark mode
- **File:** `src/components/holographic/glass-card.tsx:27`
- **Fix:** Replace `dark:bg-white/5` with `dark:bg-foreground/5`.

### [VIS-N4] Inline toast uses hardcoded white in dark mode
- **File:** `src/components/chat/inline-toast.tsx:24`
- **Fix:** Replace `dark:border-white/10` and `dark:text-white` with theme tokens.

### [VIS-N5] Chat header shadow uses hardcoded rgba
- **File:** `src/components/chat/chat-header.tsx:105,200`
- **Fix:** Define a `--shadow-chat-header` CSS variable.

### [VIS-N6] Pricing page inline style with hardcoded red hex
- **File:** `src/app/pricing/page.tsx:424`
- **Fix:** Use Tailwind `decoration-red-400` class.

### [VIS-N7] Screenshot background uses hardcoded hex
- **File:** `src/app/chat/page.tsx:426`
- **Fix:** Read computed background-color via `getComputedStyle`.

### [VIS-N8] Inline paddingBottom should be Tailwind class
- **File:** `src/components/chat/message-list.tsx:298`
- **Fix:** Replace `style={{ paddingBottom: 80 }}` with `className="pb-20"`.

### Security

### [SEC-N1] No CSP form-action directive
- **File:** `next.config.ts:20`
- **Fix:** Add `form-action 'self';` to CSP header.

### [SEC-N2] persistUserJourney doesn't validate username length
- **File:** `src/lib/supabase/client-journey.ts:79-80`
- **Fix:** Add `.slice(0, 50)` after trim.

### [SEC-N3] persistUserJourney doesn't validate customCharacterNames
- **File:** `src/lib/supabase/client-journey.ts:88-90`
- **Fix:** Add length validation for keys and values.

### [SEC-N4] Client-side mock_ai localStorage check
- **File:** `src/hooks/use-chat-api.ts:255`
- **Fix:** Remove `localStorage.getItem('mock_ai')` check or gate behind dev-only condition.

### User Flows

### [UF-N1] Zustand persist has no protection against corrupted localStorage
- **File:** `src/stores/chat-store.ts`
- **Fix:** Add a `deserialize` option with try/catch or a `merge` function that validates shape.

### [UF-N2] Settings progress bar formula can go negative
- **File:** `src/components/settings/settings-panel.tsx:301`
- **Fix:** Add `Math.max(0, ...)` inside the width formula.

### [UF-N3] Delete All Chat in chat-settings uses native confirm()
- **File:** `src/components/chat/chat-settings.tsx:748`
- **Fix:** Replace with custom Dialog matching settings-panel.tsx pattern.

### [UF-N4] AuthManager and PostAuthPage race to sync
- **File:** `src/components/orchestrator/auth-manager.tsx`, `src/app/post-auth/page.tsx`
- **Fix:** Have PostAuthPage signal via sessionStorage that it handled initial sync.

### [UF-N5] DowngradeKeeperModal has no error feedback
- **File:** `src/components/squad/downgrade-keeper-modal.tsx:85-102`
- **Fix:** Add error state and display message when callbacks throw.

### [UF-N6] 404 page doesn't adapt link for authenticated users
- **File:** `src/app/not-found.tsx`
- **Fix:** Check auth state and link to `/chat` if logged in.

### SEO

### [SEO-N1] Sitemap missing /pricing
- **File:** `src/app/sitemap.ts:5-31`
- **Fix:** Add pricing entry with priority 0.9.

### Accessibility

### [A11Y-N1] Checkout error banner missing role="alert"
- **File:** `src/app/pricing/page.tsx:279-292`
- **Fix:** Add `role="alert"` to the error banner div.

### [A11Y-N2] MessagesRemainingBanner missing live region
- **File:** `src/components/billing/messages-remaining-banner.tsx:27`
- **Fix:** Add `role="status"` and `aria-live="polite"`.

### [A11Y-N3] Settings usage progress bar lacks ARIA progressbar role
- **File:** `src/components/settings/settings-panel.tsx:290-305`
- **Fix:** Add `role="progressbar"` with `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

### Billing

### [BILL-N1] Cancelled/expired webhooks pass null event ID (no idempotency)
- **File:** `src/app/api/webhook/dodo-payments/route.ts:223-271`
- **Fix:** Pass `data.webhook_id` instead of `null`.

### Database

### [DB-N1] updated_at columns missing NOT NULL (subscriptions, memories, gang_members, squad_tier_members)
- **Files:** Multiple migrations
- **Fix:** `ALTER TABLE ... ALTER COLUMN updated_at SET NOT NULL;` for each.

### [DB-N2] No CHECK on gang_members.relationship_score
- **Fix:** `CHECK (relationship_score >= 0 AND relationship_score <= 100)`

### [DB-N3] Unused gang_vibe_score column on profiles
- **Fix:** `ALTER TABLE profiles DROP COLUMN IF EXISTS gang_vibe_score;`

### Performance

### [PERF-N1] framer-motion on landing page (~30KB gzipped)
- **File:** `src/components/landing/landing-page.tsx`
- **Fix:** Consider CSS animations + Intersection Observer for simpler effects. Low priority.

### [PERF-N2] Sequential LLM calls in memory compaction
- **File:** `src/lib/ai/memory.ts:585-608`
- **Fix:** Parallelize with `Promise.all()`. Runs in waitUntil, rare trigger, low priority.

---

## What Was NOT Found (things working correctly)

- **No hsl/oklch mismatches remaining** -- F-I11 fix is clean
- **All API routes authenticated** -- every route checks `supabase.auth.getUser()`
- **No XSS vectors** -- user content is never rendered as raw HTML
- **CSRF properly handled** -- Next.js server actions + admin origin check
- **Admin panel properly secured** -- HMAC sessions, brute-force lockout, PBKDF2, timing-safe compare
- **Webhook signature verified** -- DodoPayments SDK handles this
- **No secrets in client bundle** -- only NEXT_PUBLIC_ vars exposed
- **Rate limiter fails closed** -- Redis outage blocks requests (correct)
- **Auth callback prevents open redirect** -- strict allowlist
- **Safe area insets properly handled** -- env() used throughout
- **prefers-reduced-motion respected** -- animations disabled properly
- **Chat scroll behavior correct** -- proper scroll locking during AI response
- **Typing simulation well-tuned** -- 400ms-3s range with per-character variety
- **Cooldown countdown works** -- timer + disabled input + paywall popup
- **No redirect loops possible** -- all navigation paths terminate
- **Autonomous flow has proper safeguards** -- burst limits, backoff, visibility checks
