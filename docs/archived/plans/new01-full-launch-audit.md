# MyGang Full Launch Audit v2

**Date:** 2026-03-08
**Audited by:** 5 parallel agents covering CSS/Visual/Mobile, Security, User Flows/Edge Cases, Database/Performance, SEO/Accessibility/Billing/Chat
**Scope:** Every source file, migration, API route, component, hook, and store
**Previous audit (v1):** 1 critical + 26 important + 24 nice-to-have — all fixed in commit 3f5bb9d. None re-reported here.

---

## Summary
- **3 critical** (must fix before launch)
- **25 important** (should fix before launch)
- **28 nice-to-have** (can fix post-launch)

---

## Critical

### [UF-C1] DowngradeKeeperModal: `isSaving` resets before async callbacks finish — double-submit
- **File:** `src/components/squad/downgrade-keeper-modal.tsx:85-102`
- **What's wrong:** `handleConfirm` and `handleAutoRemove` call `onConfirm()`/`onAutoRemove()` without `await`. The `finally` block immediately sets `isSaving(false)` and re-enables the buttons while the server actions are still in flight. Users can double-click, triggering duplicate `saveGang`/`deactivateSquadTierMembers` calls.
- **Impact:** Double submission of downgrade squad changes. Two concurrent `saveGang` calls can produce inconsistent gang state on the server.
- **Fix:** Add `await` before `onConfirm(Array.from(selectedIds))` and `await onAutoRemove()`. Update the prop types to return `Promise<void>`.
- **Benefit:** The "Keep these members" and "Decide for me" buttons stay disabled until the server actually finishes saving.

### [UF-C2] UpgradePickerModal: silent failure on save error, partial state possible
- **File:** `src/components/squad/upgrade-picker-modal.tsx:84-108`
- **What's wrong:** When `handleConfirm` fails (either `saveGang` or `addSquadTierMembers` throws), the `catch` block only resets `saving` to false. No toast, no error message, no feedback. Meanwhile, intro messages may have already been posted if `saveGang` succeeded but `addSquadTierMembers` failed.
- **Impact:** Users think adding members failed silently and may retry or dismiss the modal. Characters could be added to the gang DB but not tracked in `squad_tier_members`.
- **Fix:** Add error feedback (`setSaveError('Could not add members. Please try again.')`) and only post intro messages AFTER both server calls succeed.
- **Benefit:** Users get clear feedback when adding new members fails instead of a silent reset.

### [SEC-C1] `updateUserSettings` allows squad-size paywall bypass via `preferred_squad`
- **File:** `src/app/auth/actions.ts:456-470`
- **What's wrong:** The `updateUserSettings` server action accepts a `preferred_squad` array (up to 6 entries via Zod `.max(6)`) and writes it to `profiles` without checking the user's subscription tier. Unlike `saveGang` (which enforces `getSquadLimit(tier)`), this path has no tier check. A free-tier user (limited to 4 squad members) can call `updateUserSettings({ preferred_squad: ['kael','nyx','atlas','luna','rico','vee'] })` to store 6 members.
- **Impact:** Free users can circumvent the squad-size paywall. The `preferred_squad` value is used as a fallback in `fetchJourneyState` and synced back to the client.
- **Fix:** Add tier validation when `preferred_squad` is present — fetch the user's `subscription_tier`, compute `getSquadLimit(tier)`, and reject if the array exceeds the limit. Also validate that all IDs are valid character IDs.
- **Benefit:** Stops free users from bypassing the paid squad-size limit through the settings update path.

---

## Important

### Security

### [SEC-I1] `updateUserSettings` has no rate limiting
- **File:** `src/app/auth/actions.ts:456-470`
- **What's wrong:** Unlike `saveGang`, `saveUsername`, `deleteMemory`, and other mutation actions, `updateUserSettings` has no `rateLimit()` call. Each call issues an UPDATE to the `profiles` table.
- **Impact:** An attacker could call this thousands of times per second, exhausting Supabase write quotas.
- **Fix:** Add `rateLimit('update-settings:' + user.id, 20, 60_000)` after auth check.
- **Benefit:** Prevents abuse of the settings update endpoint.

### [SEC-I2] `addSquadTierMembers` trusts client-supplied `tier` parameter
- **File:** `src/app/auth/actions.ts:550-564`
- **What's wrong:** Accepts a `tier` parameter of type `'basic' | 'pro'` from the client. A free-tier user can call `addSquadTierMembers(['kael', 'nyx'], 'pro')` and the server stores those rows with `added_at_tier: 'pro'` without verifying the user's actual subscription tier. No rate limiting, no character ID validation, no array length limit.
- **Impact:** Users can poison the `squad_tier_members` table with false tier data used by the webhook's squad-restoration logic.
- **Fix:** Read actual tier from DB instead of trusting client. Add rate limiting and character ID validation.
- **Benefit:** Prevents tier spoofing in the squad tier tracking system.

### [SEC-I3] Squad tier member actions lack input validation and rate limiting
- **File:** `src/app/auth/actions.ts:566-600`
- **What's wrong:** `deactivateSquadTierMembers` and `restoreSquadTierMembers` accept arbitrary `characterIds` arrays with no Zod validation, no length limits, no character ID validation, and no rate limiting.
- **Impact:** Potential DoS via expensive DB queries with extremely long arrays passed to `.in('character_id', characterIds)`.
- **Fix:** Add character ID validation and rate limiting to both functions.
- **Benefit:** Prevents abuse of squad management endpoints.

### [SEC-I4] Webhook `onSubscriptionCancelled` and `onSubscriptionExpired` lack idempotency
- **File:** `src/app/api/webhook/dodo-payments/route.ts:223-271`
- **What's wrong:** Both handlers call `logBillingEvent` with `null` as `dodo_event_id`, skipping the idempotency check. If DodoPayments retries these webhooks, they process multiple times. The `onSubscriptionActive` and `onSubscriptionRenewed` handlers correctly extract `webhook_id` for idempotency.
- **Impact:** A re-delivered cancellation webhook could re-downgrade a user who re-subscribed, or cause `pending_squad_downgrade` to be set multiple times.
- **Fix:** Extract `webhook_id` from the data payload and pass it to `logBillingEvent`. Check `isNew` before processing.
- **Benefit:** Cancelled and expired webhook events get the same duplicate protection as activation events.

### Visual / Mobile

### [VIS-I1] Message action buttons (like/reply) critically undersized touch targets ///dont do this.. 
- **File:** `src/components/chat/message-item.tsx:371,386`
- **What's wrong:** Like and reply buttons use `p-2 -m-1.5` with `w-3 h-3` (12px) icons. Effective touch area is ~28px, far below the 44px WCAG minimum.
- **Impact:** Mobile users frequently mis-tap or fail to hit the like/reply buttons — the most-used interactive elements in the app.
- **Fix:** Change to `min-w-[44px] min-h-[44px] flex items-center justify-center`. Remove `-m-1.5`.
- **Benefit:** Users can reliably like and reply to messages on phones. 

### [VIS-I2] Chat header icon buttons undersized on mobile ///dont do this..
- **File:** `src/components/chat/chat-header.tsx:222,233,240,256`
- **What's wrong:** All four header buttons (refresh, memory, theme, settings) use `size-9` (36px) on mobile, below the 44px minimum.
- **Impact:** Header actions are hard to tap on mobile.
- **Fix:** Change `size-9 sm:size-10` to `size-11 sm:size-11 lg:size-9` (44px mobile, 36px desktop).
- **Benefit:** Header buttons become comfortably tappable on all phone sizes.

### [VIS-I3] Send button undersized on mobile
- **File:** `src/components/chat/chat-input.tsx:174`
- **What's wrong:** Send button uses `w-10 h-10` (40px), 4px below the 44px minimum.
- **Impact:** The single most-tapped element in the app is slightly undersized.
- **Fix:** Change `w-10 h-10` to `w-11 h-11`.
- **Benefit:** Sending messages becomes reliably easy on every device.

### [VIS-I4] Animations ignore `prefers-reduced-motion` on about, terms, and pricing pages
- **Files:** `src/app/about/page.tsx:16`, `src/app/terms/page.tsx:54`, `src/app/pricing/page.tsx:534-599`
- **What's wrong:** `SpinningLogo` uses Tailwind's `animate-spin` which is NOT covered by the `globals.css` reduced-motion rule (only custom classes like `animate-spin-slow` are). Pricing page inline `@keyframes` also have no reduced-motion disable.
- **Impact:** Vestibular-sensitive users see continuously spinning/animated elements with no way to stop them.
- **Fix:** Either add `animate-spin` to the globals.css reduced-motion rule, or use `motion-reduce:animate-none` on spinning elements. Add `@media (prefers-reduced-motion: reduce)` to the pricing inline styles.
- **Benefit:** Three pages become accessible to users with motion sensitivity.

### User Flows

### [UF-I1] Cooldown notification timer accumulates without cleanup
- **File:** `src/hooks/use-chat-api.ts:314-322`
- **What's wrong:** Each paywall hit creates a new `setTimeout` for the cooldown notification. Previous timer is never cleared. Timer is stored on `window.__mygangCooldownNotif` but never cleaned up on unmount.
- **Impact:** Users could receive multiple stacked browser notifications saying "Your gang is ready!" at different times.
- **Fix:** Clear existing timer before setting new one. Clear timer in useEffect cleanup.
- **Benefit:** Users only receive one notification per cooldown period.

### [UF-I2] Purchase celebration can fire during active AI generation
- **File:** `src/app/chat/page.tsx:241-300`
- **What's wrong:** The purchase celebration has a 1500ms delay before calling `sendToApi`. During that delay, history bootstrap or greeting could start generating. The celebration API call then collides with active generation.
- **Impact:** Two concurrent `sendToApi` calls race, causing interleaved typing animations and doubled messages.
- **Fix:** Add `if (api.isGeneratingRef.current) return` inside the delayed callback.
- **Benefit:** Celebration message won't collide with ongoing AI generation.

### [UF-I3] Chat settings Delete Account still uses native `confirm()`
- **File:** `src/components/chat/chat-settings.tsx:361`
- **What's wrong:** Uses `window.confirm()` instead of the custom two-step confirmation flow used in `settings-panel.tsx`. Account deletion is irreversible.
- **Impact:** Weaker confirmation for a destructive action. Inconsistent UX across the two settings surfaces.
- **Fix:** Use the same email-confirmation + double-click pattern as `settings-panel.tsx`, or remove the duplicate Delete Account button from chat-settings.
- **Benefit:** Consistent, safe account deletion experience everywhere.

### [UF-I4] AuthManager `syncSession` can run concurrently without a lock
- **File:** `src/components/orchestrator/auth-manager.tsx:72-248`
- **What's wrong:** `syncSession` is called from both the initial mount and `onAuthStateChange`. If auth state changes during initial sync, two `syncSession` calls run concurrently, both fetching journey state and potentially showing conflicting UI.
- **Impact:** Race condition where two concurrent syncs produce conflicting state updates. Tier transition detection could fire incorrectly.
- **Fix:** Add a `syncInFlightRef` guard (same pattern as `historySyncInFlightRef` in `useChatHistory`).
- **Benefit:** Prevents double-sync races during login.

### [UF-I5] Memory Vault search query not reset when reopening
- **File:** `src/components/chat/memory-vault.tsx:128-138`
- **What's wrong:** When the vault opens, it resets cursor and reloads memories, but does NOT reset `searchQuery`. A stale search filter silently persists from the previous session.
- **Impact:** Users may think they have fewer memories than they actually do.
- **Fix:** Add `setSearchQuery('')` when `isOpen` becomes true.
- **Benefit:** Users always see all their memories when opening the vault.

### [UF-I6] Post-auth page `resolveJourney` error not caught
- **File:** `src/app/post-auth/page.tsx:24-58`
- **What's wrong:** `resolveJourney` makes async calls without try-catch. If `fetchJourneyState` throws (network error), the error propagates as an unhandled promise rejection. The 8-second fallback timeout eventually redirects, but the user stares at a spinner with no explanation.
- **Impact:** On network error, user is stuck on a spinning page for 8 seconds with no error message.
- **Fix:** Add try-catch around `resolveJourney` call. Optionally show an error state.
- **Benefit:** Users get a meaningful error instead of staring at a spinner.

### [UF-I7] Empty `handleSend` bypasses `isGenerating` guard
- **File:** `src/hooks/use-chat-api.ts:629-647`
- **What's wrong:** When `handleSend("")` is called with empty content, the intro/autonomous path goes directly to `sendToApi` without checking `isGeneratingRef.current`. This bypasses the generation guard that protects the normal send path.
- **Impact:** Potential concurrent API calls if called during active generation.
- **Fix:** Add `if (isGeneratingRef.current) return` before the intro/autonomous `sendToApi` call.
- **Benefit:** Prevents concurrent API calls when handleSend is called during active generation.

### [UF-I8] AuthManager `squad_tier_members` query error could crash auth sync
- **File:** `src/components/orchestrator/auth-manager.tsx:188-199`
- **What's wrong:** The downgrade detection queries `squad_tier_members` using `(supabase as any)`. If the query throws (rather than returning an error), it crashes the entire `syncSession` function, preventing hydration.
- **Impact:** If the query fails, the entire auth sync crashes and the app won't hydrate.
- **Fix:** Wrap the query in try-catch with a fallback to empty array.
- **Benefit:** Auth sync won't crash if the squad tier members query fails.

### [UF-I9] Stale `effectiveLowCostModeForCall` used after long async delays
- **File:** `src/hooks/use-chat-api.ts:199,545`
- **What's wrong:** `effectiveLowCostModeForCall` is computed once at call start but used 10+ seconds later in the `finally` block to decide whether to fire autonomous follow-ups. If the user toggled low-cost mode during the response, the decision uses stale state.
- **Impact:** Autonomous follow-up could fire even though low-cost mode was enabled mid-response, burning API credits.
- **Fix:** Re-read current low-cost state from store in the `finally` block: `useChatStore.getState().lowCostMode`.
- **Benefit:** Autonomous follow-up decision uses current settings, not stale ones.

### [UF-I10] Celebration timer from DB fallback path not cleaned up
- **File:** `src/app/chat/page.tsx:278-298`
- **What's wrong:** The DB fallback path calls `triggerCelebration(plan)` but doesn't capture the returned timer. The effect's cleanup sets `cancelled = true` but doesn't clear the timer. If the component unmounts before the timer fires, it could call `sendToApiRef` on a stale component.
- **Impact:** Potential double-celebration or stale timer firing after component remount.
- **Fix:** Capture the timer returned by `triggerCelebration` and clear it in the cleanup function.
- **Benefit:** No stale celebrations after navigation.

### Database

### [DB-I1] `deleteAllMessages` and `deleteAllMemories` are unbounded DELETE operations
- **File:** `src/app/auth/actions.ts:472-519`
- **What's wrong:** Both issue `DELETE ... WHERE user_id = ?` without a LIMIT. For users with thousands of messages, this is a single large transaction that can hold locks and time out on Supabase.
- **Impact:** Heavy users could experience timeouts or lock contention when deleting all data.
- **Fix:** Implement batched deletion (delete in chunks of 500 using a select-then-delete loop).
- **Benefit:** Prevents statement timeouts for power users with large histories.

### [DB-I2] Missing index on `analytics_events.user_id`
- **File:** `supabase/migrations/20260206223500_add_analytics_events.sql`
- **What's wrong:** Table has indexes on `event`, `created_at`, and `session_id`, but NOT on `user_id`. The RLS policy `USING (auth.uid() = user_id)` fires on every SELECT, requiring sequential scan.
- **Impact:** As the analytics table grows, every RLS-filtered query gets progressively slower.
- **Fix:** `CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);`
- **Benefit:** Keeps RLS-filtered queries fast as the analytics table scales.

### [DB-I3] Memory archive updates miss `user_id` scope (defense-in-depth)
- **File:** `src/lib/ai/memory.ts:96-101,205-209`
- **What's wrong:** When archiving conflicting memories, `.update({ kind: 'archived' }).in('id', toArchive)` does not include `.eq('user_id', userId)`. RLS should prevent cross-user updates, but this is a defense-in-depth gap.
- **Impact:** If RLS context were ever wrong, the update could theoretically affect other users' memories.
- **Fix:** Add `.eq('user_id', userId)` to all `.in('id', ...)` update/delete calls in the memory module.
- **Benefit:** Defense-in-depth ensures memory operations are always user-scoped.

### Performance

### [PERF-I1] Chat route persistence has sequential waterfall of 5+ DB queries
- **File:** `src/app/api/chat/route.ts:1434-1621`
- **What's wrong:** The `waitUntil()` persistence block runs these sequentially: `increment_profile_counters` → `touchMemories` → `storeMemories` → gang upsert → history query → history insert. Steps 1-3 (profile/memory) are independent of steps 4-6 (chat history).
- **Impact:** Background persistence takes longer than necessary, increasing the chance of `waitUntil` budget exhaustion on Vercel.
- **Fix:** Split into two parallel branches with `Promise.all([memoryBranch(), historyBranch()])`.
- **Benefit:** Cuts background persistence time roughly in half.

### [PERF-I2] Dead legacy fallback in `getChatHistoryPage` causes double queries
- **File:** `src/app/auth/actions.ts:415-432`
- **What's wrong:** On first call, always queries with metadata columns; on `isMissingHistoryMetadataColumnsError`, retries without them. The metadata columns were added in migration `20260211001000` — this fallback is now dead code.
- **Impact:** Code complexity. On edge case, causes two round-trip queries instead of one.
- **Fix:** Remove the legacy fallback path entirely. The columns exist on all production instances.
- **Benefit:** Eliminates dead code and prevents accidental double-query.

### [PERF-I3] No virtualization for 200+ messages in message list
- **File:** `src/components/chat/message-list.tsx:322-374`
- **What's wrong:** Every message in the array is rendered as a DOM node. With 100 persisted + older history loaded via pagination, a user could have 200+ messages rendered simultaneously.
- **Impact:** On lower-end mobile devices, scrolling through 200+ messages is janky. High memory usage from DOM nodes.
- **Fix:** Use `@tanstack/react-virtual` or `react-virtuoso` to only render ~15-20 visible messages.
- **Benefit:** Dramatically improves scroll performance and memory usage on mobile.

### [PERF-I4] Eager `framer-motion` import on landing page (~30KB gzipped)
- **File:** `src/components/landing/landing-page.tsx:4`
- **What's wrong:** Directly imports `motion, useReducedMotion, useScroll, useTransform, AnimatePresence` from `framer-motion`, loading the entire bundle on the initial landing page visit.
- **Impact:** Increases First Contentful Paint and LCP for new visitors — the most important audience to convert.
- **Fix:** Use `LazyMotion` with `domAnimation` from `framer-motion` to reduce initial bundle, or lazy-load animated sections.
- **Benefit:** Smaller initial JS bundle for the landing page, improving conversion-critical metrics.

### SEO

### [SEO-I1] OG image is 1024x1024 square, not proper 1200x630 social preview ///i have created it, here is the path to the file "C:\coding\mygangbyantig\og-image.png", move it and use it. 
- **File:** `src/app/layout.tsx:57-62`
- **What's wrong:** OG and Twitter card images point to `/icon-512.png` (actually 1024x1024 square). Social platforms expect 1200x630 landscape. Metadata declares wrong dimensions (512x512).
- **Impact:** Social shares on Twitter, Facebook, Discord, LinkedIn look like a tiny logo in a blank box instead of a branded hero image.
- **Fix:** Create a 1200x630 `og-image.png` with MyGang.ai branding. Update metadata dimensions.
- **Benefit:** Social shares display a branded preview card that drives more clicks and signups.

### [SEO-I2] Pricing page FAQ content not in initial HTML (client component)
- **File:** `src/app/pricing/page.tsx:1`
- **What's wrong:** Entire pricing page is `'use client'`. FAQ answers and feature table are client-rendered, meaning Googlebot's initial HTML crawl may miss them.
- **Impact:** FAQ content that could rank for long-tail queries is invisible to search crawlers.
- **Fix:** Extract static parts (feature table, FAQ list) into a server component. Add JSON-LD `FAQPage` structured data.
- **Benefit:** FAQ content becomes crawlable, potentially generating rich FAQ snippets in Google results.

### Accessibility

### [A11Y-I1] `MessagesRemainingBanner` lacks `aria-live` for dynamic content
- **File:** `src/components/billing/messages-remaining-banner.tsx:27`
- **What's wrong:** Banner dynamically updates message count but has no `aria-live` attribute.
- **Impact:** Screen reader users don't know when they're running low on messages.
- **Fix:** Add `role="status"` and `aria-live="polite"` to the outer div.
- **Benefit:** Screen reader users are informed when their message count drops.

### [A11Y-I2] Avatar lightbox has no focus trap or focus restoration
- **File:** `src/components/chat/message-item.tsx:449-493`
- **What's wrong:** Lightbox has `role="dialog"` and `aria-modal="true"`, but Tab can escape to content behind it. Focus is not restored to the trigger element on close.
- **Impact:** Keyboard users can Tab out of the lightbox. After closing, focus is lost.
- **Fix:** Implement a focus trap and store/restore trigger element reference.
- **Benefit:** Keyboard users stay inside the lightbox and return to the correct place after closing.

---

## Nice-to-Have

### Security

### [SEC-N1] `req.json()` without error handling in checkout and activate routes
- **File:** `src/app/api/checkout/route.ts:31`, `src/app/api/checkout/activate/route.ts:96`
- **Fix:** Use `.catch(() => null)` and return 400 for malformed JSON.

### [SEC-N2] `custom_character_names` in settings schema allows unbounded key count
- **File:** `src/app/auth/actions.ts:37`
- **Fix:** Add `.refine()` to limit entries to 6 and validate keys are character IDs.

### [SEC-N3] `preferred_squad` in settings schema accepts arbitrary strings
- **File:** `src/app/auth/actions.ts:35`
- **Fix:** Add `.refine()` to validate against `validCharacterIds`.

### [SEC-N4] Paginated data-fetching server actions lack rate limiting
- **File:** `src/app/auth/actions.ts:355-454`
- **Fix:** Add lightweight rate limiting (30 calls/60s) to `getMemoriesPage` and `getChatHistoryPage`.

### Visual

### [VIS-N1] Starter chip buttons undersized (32px height) ///dont do it
- **File:** `src/components/chat/chat-input.tsx:135`
- **Fix:** Add `min-h-[44px]` to ensure minimum touch target.

### [VIS-N2] Scroll-to-bottom button undersized (36px) ///dont do it
- **File:** `src/components/chat/message-list.tsx:418`
- **Fix:** Change `size-9` to `size-11` (44px).

### [VIS-N3] Z-index overlap between inline toast and scroll-to-bottom button
- **File:** `src/components/chat/inline-toast.tsx:23`, `src/components/chat/message-list.tsx:411`
- **Fix:** Bump inline-toast to `z-[55]`.

### [VIS-N4] Landing page carousel arrows undersized on mobile (40px)
- **File:** `src/components/landing/landing-page.tsx:801,830`
- **Fix:** Change `w-10 h-10` to `w-11 h-11`.

### [VIS-N5] Landing page carousel dots undersized (24px touch target)
- **File:** `src/components/landing/landing-page.tsx:813`
- **Fix:** Increase padding to `p-3` or add `min-w-[44px] min-h-[44px]`.

### Database

### [DB-N1] `chat_history` pagination orders by `(created_at DESC, id DESC)` but no composite index covers both
- **File:** `src/app/auth/actions.ts:401-412`
- **Fix:** Remove the secondary `.order('id', ...)` (UUID v4 is random, not meaningful for ordering).

### [DB-N2] `profiles.chat_wallpaper` and `profiles.chat_mode` lack CHECK constraints
- **Fix:** Add CHECK constraints for valid enum values.

### [DB-N3] `profiles.theme` column lacks CHECK constraint
- **Fix:** `CHECK (theme IS NULL OR theme IN ('light', 'dark', 'system'))`.

### [DB-N4] `handle_updated_at()` function not revoked from anon role
- **Fix:** `REVOKE EXECUTE ON FUNCTION handle_updated_at() FROM anon;`

### Performance

### [PERF-N1] N parallel semantic dedup RPC calls consume connection pool
- **File:** `src/lib/ai/memory.ts:281-307`
- **Fix:** Add early-exit when no existing memories to compare against. Consider batching into a single SQL function.

### [PERF-N2] Lottie animation fetched on every empty-state mount
- **File:** `src/components/chat/message-list.tsx:49-62`
- **Fix:** Cache animation data and Lottie component in module-level variables.

### [PERF-N3] `characterStatuses` creates new objects on every status update
- **File:** `src/stores/chat-store.ts:130-132`
- **Fix:** Consumers should select individual character statuses, not the entire object.

### [PERF-N4] MemoryVault search is client-side filter without debounce
- **File:** `src/components/chat/memory-vault.tsx:180-183`
- **Fix:** Add `useDeferredValue` or debounce the search input.

### [PERF-N5] Three Google Fonts loaded, Geist Mono possibly unused
- **File:** `src/app/layout.tsx:8-22`
- **Fix:** Audit whether Geist Mono is used. If not, remove it to save ~20KB.

### SEO

### [SEO-N1] `not-found.tsx` has no metadata export
- **Fix:** Add `metadata` with `title: 'Page Not Found'` and `robots: { index: false }`.

### [SEO-N2] No JSON-LD structured data on pricing page
- **Fix:** Add `FAQPage` schema in `src/app/pricing/layout.tsx` with the 5 FAQ items.

### [SEO-N3] `robots.txt` uses deprecated `host` directive
- **File:** `src/app/robots.ts:26`
- **Fix:** Remove the `host: siteUrl` line.

### Accessibility

### [A11Y-N1] `ChatSkeleton` loading state `aria-label` on div without role
- **File:** `src/components/chat/message-list.tsx:16`
- **Fix:** Add `role="status"` to the div.

### [A11Y-N2] Paywall popup countdown not announced to screen readers
- **File:** `src/components/billing/paywall-popup.tsx:97-102`
- **Fix:** Add `aria-live="polite"` and `aria-atomic="true"` to the countdown container.

### [A11Y-N3] Downgrade keeper modal character buttons lack `aria-pressed`
- **File:** `src/components/squad/downgrade-keeper-modal.tsx:167-243`
- **Fix:** Add `aria-pressed={isSelected}` and descriptive `aria-label`.

### Billing

### [BILL-N1] `onPaymentSucceeded` and `onPaymentFailed` have no idempotency
- **File:** `src/app/api/webhook/dodo-payments/route.ts:273-285`
- **Fix:** Extract `webhook_id` and pass to `logBillingEvent` for idempotency.

### [BILL-N2] Paywall popup hardcodes prices instead of using `getTierCopy()`
- **File:** `src/components/billing/paywall-popup.tsx:130,147`
- **Fix:** Use `getTierCopy('pro').priceLabel` for CTA button text.

### [BILL-N3] Checkout success page has no metadata (no tab title)
- **Fix:** Create `src/app/checkout/success/layout.tsx` with `title: 'Upgrade Successful'`.

### User Flows

### [UF-N1] `debounceTimerRef` not cleared on unmount
- **File:** `src/hooks/use-chat-api.ts:138,561-575`
- **Fix:** Clear debounce timer in useEffect cleanup alongside abort controller.

### [UF-N2] Message prepend scroll restoration captures post-render scrollHeight
- **File:** `src/components/chat/message-list.tsx:238-246`
- **Fix:** Capture previous scroll height before render using `useLayoutEffect`.

### Chat

### [CHAT-N1] No session-wide cap on total autonomous API calls
- **File:** `src/hooks/use-autonomous-flow.ts:108`
- **Fix:** Add a `totalAutoCallsRef` capped at 15-20 per session.

### [CHAT-N2] Delivery status `aria-live` on every message causes excessive announcements
- **File:** `src/components/chat/message-item.tsx:414`
- **Fix:** Move `aria-live` to a single announcement region at the message list level.

### [CHAT-N3] Chat history polling timeout chain can accumulate
- **File:** `src/hooks/use-chat-history.ts:344-401`
- **Fix:** Clear previous timeout before scheduling new one in visibility/focus handlers.

---

## What Was NOT Found (things working correctly)

- **No hsl/oklch mismatches** — all CSS uses oklch properly
- **All API routes authenticated** — every route checks `supabase.auth.getUser()`
- **No XSS vectors** — user content never rendered as raw HTML
- **No SQL injection** — all queries use parameterized Supabase client
- **Admin panel properly secured** — HMAC sessions, brute-force lockout, PBKDF2, timing-safe compare
- **Webhook signature verified** — DodoPayments SDK handles this
- **No secrets in client bundle** — only `NEXT_PUBLIC_` vars exposed
- **`subscriptionTier` NOT in localStorage** — not in `partialize`, so client-side tier manipulation impossible
- **Tier enforcement always server-side** — from database, not client state
- **Rate limiter fails closed** — Redis outage blocks requests
- **Auth callback prevents open redirect** — strict allowlist
- **Safe area insets properly handled** — `env()` used throughout
- **Dark mode handled correctly** — oklch variables properly defined for both themes
- **Chat scroll behavior correct** — proper scroll locking during AI response
- **Typing simulation well-tuned** — 400ms-3s range with per-character variety
- **Autonomous flow has safeguards** — burst limits, backoff, visibility checks
- **No redirect loops possible** — all navigation paths terminate
- **`prefers-reduced-motion` respected** for custom animations (only built-in `animate-spin` missed)
