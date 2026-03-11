# Bug Audit -- 2026-03-06

Auditor: Claude Opus 4.6
Scope: All source files in `src/`

---

## MAJOR BUGS (breaks functionality or causes data issues)

### M1. Stale closure on `sendToApi` -- every call uses stale props

**File:** `src/hooks/use-chat-api.ts`, lines 160-443
**Severity:** MAJOR

`sendToApi` is defined as a plain `async function` inside the hook body (not wrapped in `useCallback`), so it captures the closure values from the render where it was defined. However, it is stored on a ref (`sendToApiRef.current = sendToApi` at line 444) and called later by the autonomous flow, debounce timers, and the `finally` block.

The values `lowCostMode`, `chatMode`, `messages`, `activeGang`, `userName`, `userNickname`, and `isOnline` are all captured at definition time. When called via ref from a timer or autonomous flow seconds/minutes later, they will be stale. For example, if the user toggles `lowCostMode` ON, a pending debounced call still uses the old `lowCostMode: false`.

The `autoLowCostModeRef` is correctly passed as a ref, but `lowCostMode` itself (line 161) is read from the closure, not from the store.

**Impact:** Autonomous and debounced calls may use wrong chat mode, wrong gang, wrong low-cost setting, or wrong user name. Could send requests with stale data.

**Fix:** Either wrap in `useCallback` with correct deps, or read all mutable values from `useChatStore.getState()` inside the function body instead of from closure variables.

---

### M2. `sendToApi` recursive call in `finally` block can cause infinite loop

**File:** `src/hooks/use-chat-api.ts`, lines 424-431
**Severity:** MAJOR

In the `finally` block, if `pendingUserMessagesRef.current` is true, the code sets `isGeneratingRef.current = true` and recursively calls `sendToApi`. If the API call fails repeatedly and the user keeps typing, this creates an unbounded recursive chain where each failure triggers another call. There is no retry limit or circuit breaker.

**Impact:** Could hammer the API indefinitely on persistent errors, burning rate limits and causing poor UX.

**Fix:** Add a retry counter or limit the number of times the `finally` block can re-invoke `sendToApi`.

---

### M3. Paywall countdown timer restarts on every `secondsLeft` change

**File:** `src/components/billing/paywall-popup.tsx`, lines 34-46
**Severity:** MAJOR

The countdown `useEffect` has `secondsLeft` in its dependency array (line 46). Every time `setSecondsLeft` fires (every second), the effect re-runs, creating a new `setInterval`. Each old interval is cleared by the cleanup, but the new interval starts fresh -- meaning the countdown is effectively driven by `useEffect` re-creation, not by a steady interval.

While it mostly works, there is a subtle timing issue: on each tick, the cleanup runs, then a brand new interval is created. If `secondsLeft` reaches 1, the `clearInterval` inside the setter fires, but the `useEffect` cleanup also fires because `secondsLeft` changed to 0, and a NEW interval is created with `secondsLeft <= 0` which exits immediately. This is just wasteful, not broken per se.

However, the real bug is: if `secondsLeft` is set externally (e.g., via a new paywall trigger while already open), the effect restarts correctly. But if `open` changes to `false` and back to `true` quickly, both the reset effect (line 27-30) and the countdown effect race. This can cause the countdown to show stale values.

**Impact:** Countdown may be inaccurate or jittery under edge conditions. Paywall can show wrong time.

**Fix:** Remove `secondsLeft` from the dependency array. Only depend on `open`. Use a single `setInterval` that decrements until 0.

---

### M4. Checkout success page does not validate subscription ownership

**File:** `src/app/checkout/success/page.tsx`, lines 13-44
**Severity:** MAJOR

The `subscription_id` comes directly from URL search params (user-controlled). The `/api/checkout/activate` endpoint (line 19-23) takes this `subscription_id` and activates it for the currently logged-in user. There is no server-side check that the subscription actually belongs to this user.

An attacker could craft a URL with someone else's `subscription_id` and get their own profile upgraded.

**Impact:** Subscription tier escalation / billing fraud.

**Fix:** In `/api/checkout/activate/route.ts`, verify that the subscription's `customer_id` matches the authenticated user's `dodo_customer_id` before updating the profile.

---

### M5. Webhook handler silently drops events when `findUserByCustomerId` returns null

**File:** `src/app/api/webhook/dodo-payments/route.ts`, lines 52-122
**Severity:** MAJOR

All webhook handlers call `findUserByCustomerId` and `return` silently if `userId` is null (e.g., lines 58, 71, 85, 100). If the webhook arrives before the profile's `dodo_customer_id` is saved (race condition during checkout), the subscription activation is silently lost. DodoPayments will not retry the webhook since the handler returned successfully (no error thrown/returned).

**Impact:** User pays but never gets activated. No error logged, no retry.

**Fix:** Throw an error or return a non-2xx status code when `userId` is null so the webhook provider retries. Alternatively, implement a dead-letter queue.

---

### M6. In-memory rate limiting is per-serverless-container and ineffective

**File:** `src/lib/rate-limit.ts`, lines 10-35
**Severity:** MAJOR (if deployed without Redis)

When `UPSTASH_REDIS_REST_URL` is not set, the rate limiter falls back to an in-memory `Map`. On Vercel (serverless), each container has its own `Map`, so a user can bypass rate limits by hitting different containers. The code does log a warning (line 15-20), but only once.

Similarly, the free-tier message gating in the chat route (`chat:free-window:${user.id}`) uses this same rate limiter. A free user could exceed 20 messages/hour by hitting multiple containers.

**Impact:** Rate limiting and billing tier enforcement are ineffective without Redis.

**Fix:** Ensure Redis is configured in production. Consider adding a database-backed fallback for billing-critical limits.

---

### M7. Module-level mutable cache in chat route is not safe for concurrent requests

**File:** `src/app/api/chat/route.ts`, lines 37-41, 61-63
**Severity:** MAJOR

`cachedGlobalLowCostOverride`, `isFetchingGlobalLowCost`, `cachedDbPromptBlocks`, and `isFetchingDbPromptBlocks` are module-level mutable variables. In a serverless environment, these variables are shared across concurrent requests within the same container.

The "cache stampede" prevention using `isFetchingGlobalLowCost` (line 204) has a TOCTOU race: two concurrent requests can both see `isFetchingGlobalLowCost === false`, both set it to `true`, and both fetch. This is a minor issue for caching, but the bigger problem is that `isFetchingGlobalLowCost` is set to `true` and only reset in `finally`. If the module is shared across requests, other requests during that fetch will return the stale cached value (which may be the default `false`).

**Impact:** Inconsistent global low-cost override behavior across concurrent requests.

---

### M8. `_messageIdSet` in chat-store is a module-level `Set` shared across all store instances

**File:** `src/stores/chat-store.ts`, lines 67-71
**Severity:** MAJOR (in specific scenarios)

`_messageIdSet` is a module-level variable, not part of the store state. If the store is cleared (`clearChat`) and then messages with the same IDs are received again (e.g., from history sync), `_messageIdSet` is cleared (line 128), so this works. However, if `setMessages` is called (line 90-101), it rebuilds the set from the new messages, which is correct.

The actual bug is: `addMessage` (line 102-111) checks `_messageIdSet.has(message.id)` before adding. But `setMessages` rebuilds the set from only the sliced messages. If `setMessages` is called with a smaller set (e.g., during history reconciliation), messages that were previously in the set but are now removed from state are still NOT in `_messageIdSet` (since it was rebuilt). This is correct.

**Downgrade to MINOR**: After closer inspection, the logic is consistent. But the pattern of using a module-level `Set` alongside Zustand state is fragile -- if two browser tabs share the same origin, they share localStorage but NOT the module-level `Set`, causing desync.

---

## MINOR BUGS (cosmetic, UX inconvenience, or edge-case issues)

### m1. `useChatApi` passes `messages` as a prop but never uses it directly

**File:** `src/hooks/use-chat-api.ts`, line 57, 84
**Severity:** MINOR

`messages` is accepted as a prop in `UseChatApiArgs` and passed from `ChatPage` (line 89 in chat/page.tsx), but `sendToApi` always reads messages from `useChatStore.getState().messages` (line 193). The `messages` prop is never read inside the hook. This is dead code that may confuse maintainers.

**Impact:** None functionally, but misleading.

---

### m2. Pricing page shows "1,000 messages per month" for Basic but billing code enforces 500

**File:** `src/app/pricing/page.tsx`, line 314 vs `src/lib/billing.ts`, line 15 vs `src/app/api/chat/route.ts`, line 693
**Severity:** MINOR (misleading marketing)

The pricing page says "1,000 messages per month" for Basic tier. The `TIER_LIMITS` in billing.ts says `monthlyLimit: 500`. The chat route enforces `rateLimit(monthlyKey, 500, ...)`. The settings panel also says "1,000 messages/month + memory" (line 69 of settings-panel.tsx).

**Impact:** Users expect 1,000 messages but hit the limit at 500. False advertising.

**Fix:** Align the pricing display with the actual enforced limit (500), or update the limit to 1,000.

---

### m3. `ChatInput` does not clear draft from localStorage on unmount

**File:** `src/components/chat/chat-input.tsx`, lines 31-46
**Severity:** MINOR

The draft is saved to localStorage on every keystroke (line 39-46) and cleared on submit (line 63). But if the user navigates away without submitting (e.g., browser back), the draft persists and will be restored next time. This is actually intended behavior (draft preservation). However, if the component is unmounted and remounted rapidly (e.g., during route transitions), the draft loading (`draftLoadedRef`) prevents double-loading, which is correct.

**Downgrade to INFO**: This is working as designed.

---

### m4. `resumeBanner` useEffect has `messages` in dependency array -- fires on every message

**File:** `src/app/chat/page.tsx`, lines 243-268
**Severity:** MINOR

The resume banner effect depends on `[isHydrated, messages]`. Since `messages` is an array from Zustand that gets a new reference on every change, this effect runs every time a message is added/modified. The `resumeBannerRef.current` guard (line 255) prevents re-showing the banner, but the effect body still runs its date calculations on every message.

**Impact:** Minor performance waste on every message. No visible bug.

**Fix:** Use `messages.length` instead of `messages` as the dependency, or move the logic to only run once.

---

### m5. `handleSend` determines `isIntro`/`isAutonomous` based on `content.trim() === ""` which is never true from user input

**File:** `src/hooks/use-chat-api.ts`, lines 513-531
**Severity:** MINOR

`handleSend` is called from `ChatInput.onSend` which only fires when `input.trim()` is truthy (line 58 of chat-input.tsx). So the `isIntro` and `isAutonomous` branches (lines 519-520) in `handleSend` are unreachable from normal user input. They are only reachable when `handleSend("")` is called programmatically. This is confusing but not broken since the autonomous flow calls `sendToApi` directly via ref.

**Impact:** Dead code paths in `handleSend` for intro/autonomous. Not a bug, but confusing.

---

### m6. `saveMemoryManual` server action has no user feedback on success or failure

**File:** `src/components/chat/message-item.tsx`, lines 476-477
**Severity:** MINOR

When a user clicks "Save" on a message, `saveMemoryManual(message.content)` is called fire-and-forget. There is no toast, no loading state, and no error handling. The user has no idea if the save succeeded.

**Impact:** Silent success/failure. Poor UX.

**Fix:** Show a toast on success/failure. Add loading state to the button.

---

### m7. `deleteAccount` server action does not delete user data from all tables

**File:** `src/app/auth/actions.ts`, lines 118-132
**Severity:** MINOR

`deleteAccount` only calls `admin.auth.admin.deleteUser(user.id)`. It does not explicitly delete rows from `profiles`, `gangs`, `gang_members`, `chat_history`, `memories`, `subscriptions`, `billing_events`, or `analytics_events`. If there are no `ON DELETE CASCADE` foreign key constraints in the database, orphaned data will remain.

**Impact:** Data retention after account deletion. Potential GDPR/privacy compliance issue.

**Fix:** Either ensure database has `ON DELETE CASCADE` on all user-related foreign keys, or explicitly delete from all tables before deleting the auth user.

---

### m8. `ChatHeader` tokenUsage display reads from a ref, never re-renders

**File:** `src/app/chat/page.tsx`, line 367
**Severity:** MINOR

`tokenUsage={api.lastTokenUsageRef.current}` passes the ref's current value at render time. Since `lastTokenUsageRef` is a `useRef`, updating it does NOT trigger a re-render. The `ChatHeader` will show stale (or null) token usage until some other state change causes `ChatPage` to re-render.

**Impact:** Dev tools token usage display is always one render behind (or stuck on the initial null).

**Fix:** Store token usage in state instead of a ref, or use a Zustand store value.

---

### m9. Chat page cleanup effect captures refs at mount time, not at unmount time

**File:** `src/app/chat/page.tsx`, lines 211-223
**Severity:** MINOR

The cleanup effect (line 211) saves `autonomous.greetingTimersRef.current` and `typing.statusTimersRef.current` into local variables at effect setup time (mount). By the time the cleanup function runs (unmount), these refs may point to different arrays/objects. The cleanup clears the old references, not the current ones.

**Impact:** Timer leaks on unmount if the refs were reassigned during the component's lifetime.

**Fix:** Read `.current` inside the cleanup function, not outside it.

---

### m10. `collapseLikelyDuplicateMessages` never deduplicates user messages

**File:** `src/hooks/use-chat-history.ts`, line 121
**Severity:** MINOR

The collapse function explicitly skips user messages: `message.speaker === 'user'` causes `continue` (line 121). This means if the same user message appears twice (e.g., from a retry + history sync), both copies will remain in the message list.

**Impact:** Duplicate user messages may appear in the chat after history sync.

---

### m11. Offline mode does not queue messages for later sending

**File:** `src/hooks/use-chat-api.ts`, lines 514-517
**Severity:** MINOR

When the user is offline, `handleSend` shows a toast and returns. The typed message is not saved or queued. If the user typed a long message while briefly offline, it's lost (though the draft is preserved in localStorage by `ChatInput`).

**Impact:** User must manually re-send after reconnecting. The chat input draft helps but the user may not realize the message wasn't sent.

---

### m12. `AuthManager` useEffect has a large dependency array that may cause excessive re-syncs

**File:** `src/components/orchestrator/auth-manager.tsx`, line 178
**Severity:** MINOR

The `syncSession` useEffect depends on 14 store setters. While Zustand setters are stable references, the `setTheme` from `next-themes` may change on theme switches, potentially re-triggering the full auth sync.

**Impact:** Unnecessary full auth re-sync when theme changes.

---

### m13. Pricing page creates a new Supabase client on every tier fetch

**File:** `src/app/pricing/page.tsx`, line 139
**Severity:** MINOR

`const supabase = createClient()` is called inside the `fetchTier` async function within a `useEffect`. Unlike the onboarding page which memoizes it with `useMemo`, this creates a new client instance on every fetch. While `createClient` may be idempotent, it's inconsistent with the rest of the codebase.

**Impact:** Minor memory/performance waste.

---

### m14. Scroll position preservation on history prepend uses `requestAnimationFrame` timing assumption

**File:** `src/components/chat/message-list.tsx`, lines 182-190
**Severity:** MINOR

When older messages are prepended, the code reads `el.scrollHeight` before `requestAnimationFrame`, then reads it again inside the rAF callback. Between those two reads, the DOM may not have updated yet (the rAF fires before paint, but React may batch). This can cause a brief scroll jump.

**Impact:** Slight visual scroll jump when loading older messages.

---

### m15. `user.email!` non-null assertion in checkout route

**File:** `src/app/api/checkout/route.ts`, line 44
**Severity:** MINOR

`user.email!` assumes the user always has an email. Users who signed up via phone or certain OAuth providers may not have an email. This would throw at runtime.

**Impact:** Checkout fails for users without an email address.

**Fix:** Provide a fallback or return an error if email is missing.

---

### m16. No CSRF protection on checkout/activate endpoint

**File:** `src/app/api/checkout/activate/route.ts`
**Severity:** MINOR

The `/api/checkout/activate` POST endpoint relies only on Supabase auth cookies for authentication. There is no CSRF token validation. A malicious site could potentially trigger a POST to this endpoint if the user is logged in.

**Impact:** Low risk since the attacker would need a valid `subscription_id`, but defense-in-depth is lacking.

---

### m17. `settings-panel.tsx` shows "messages today" but billing uses hourly/monthly windows

**File:** `src/components/settings/settings-panel.tsx`, lines 211-229
**Severity:** MINOR

The usage section displays `usage.dailyCount` and `usage.dailyLimit` with the label "messages today". But the actual billing uses either a 60-minute sliding window (free tier) or a monthly limit (basic tier). The "daily" framing is misleading.

**Impact:** User confusion about actual rate limits.

---

### m18. `onRehydrateStorage` mutates messages in-place

**File:** `src/stores/chat-store.ts`, lines 147-161
**Severity:** MINOR

The rehydration callback mutates message objects directly (`m.deliveryStatus = 'failed'`, line 152) rather than creating new objects. While this is during hydration (before React renders), it violates the immutability principle of Zustand state. The subsequent `setState` with `[...state.messages]` creates a new array but the individual message objects are still mutated in place.

**Impact:** Could cause issues with React memoization if message objects are compared by reference elsewhere.

---

### m19. Demo carousel on landing page keeps running timers when not visible

**File:** `src/components/landing/landing-page.tsx`, lines 636-663
**Severity:** MINOR

The `LiveDemoCard` component runs an infinite timer loop that animates chat bubbles. When the carousel switches to a different card, the old `LiveDemoCard` unmounts and the cleanup runs. However, while visible, the timers run even when the user has scrolled past the section (wasting CPU).

**Impact:** Minor battery/CPU drain on mobile.

**Fix:** Use `IntersectionObserver` to pause animation when not in viewport.

---

### m20. `updateUserSettings` server action accepts `custom_character_names` in schema but the route never sends it

**File:** `src/app/auth/actions.ts`, line 35 vs `src/components/chat/chat-settings.tsx`
**Severity:** MINOR

The `userSettingsSchema` includes `custom_character_names` (line 35), and the chat settings component does call `updateUserSettings` with custom names. This works. However, the `updateUserSettings` function does not validate that custom names only contain safe characters (the schema just says `z.record(z.string().max(30))`). A user could inject special characters into character names.

**Impact:** Low. Names are displayed in UI and sent to the LLM prompt, but the LLM prompt already treats conversation history as untrusted.

---

### m21. `handleRetryMessage` does not check if message is already being sent

**File:** `src/hooks/use-chat-api.ts`, lines 543-563
**Severity:** MINOR

If a user rapidly clicks "Retry" on a failed message, `handleRetryMessage` will set the delivery status back to `sending` and schedule a new debounced send each time. Multiple debounced sends could fire for the same message.

**Impact:** Duplicate messages could be sent to the API.

**Fix:** Add a guard to prevent retry if `deliveryStatus` is already `'sending'`.

---

## EDGE CASES

### E1. Very long messages

Client-side: `ChatInput` limits to 2,000 characters (MAX_CHARS). Server-side: the Zod schema also limits `content` to 2,000 chars, and `MAX_LLM_MESSAGE_CHARS` truncates to 500 chars for the LLM. **Handled correctly.**

### E2. Special characters / Unicode

`sanitizeMessageId` rejects non-alphanumeric characters. Message content is not sanitized beyond length limits, which is correct for display (React escapes HTML). The safety filters use regex on raw text, which works for basic patterns. **Mostly handled.** However, the `normalizeForSafety` function (route.ts line 269-277) only handles a few leetspeak substitutions and may miss more creative obfuscation.

### E3. Supabase down

Server: Supabase calls have `try/catch` blocks, but many early-exit with empty data rather than returning errors to the client. The chat route would fail at the `getUser()` call and return 401.
Client: History sync failures are caught and logged. The UI shows a toast on history error.
**Partially handled.** A Supabase outage would prevent login but wouldn't crash the app.

### E4. OpenRouter down

The chat route catches OpenRouter errors (line 967-1016) and distinguishes capacity errors from other failures. It returns appropriate error responses to the client. **Handled well.**

### E5. Browser back/forward

Next.js client-side routing handles back/forward. The chat page has auth guards that redirect to `/` if not authenticated. However, the chat messages are persisted in Zustand (localStorage), so navigating back and forward preserves state. **No major issues.**

### E6. Multiple tabs

If the user has multiple tabs open, all tabs share localStorage (Zustand persist). However, the module-level `_messageIdSet` in `chat-store.ts` is per-tab, so one tab's set will desync from another tab's localStorage state. The `onRehydrateStorage` callback rebuilds the set, but it only runs on initial load, not on cross-tab storage events. **Minor risk of duplicate messages across tabs.**

---

## SUMMARY

| Category | MAJOR | MINOR |
|----------|-------|-------|
| Chat Logic | 2 (M1, M2) | 4 (m1, m5, m10, m11) |
| State Management | 1 (M8) | 3 (m4, m9, m18) |
| UI/UX | 1 (M3) | 5 (m6, m8, m14, m17, m19) |
| API/Security | 3 (M4, M5, M6) | 3 (m15, m16, m21) |
| Data Consistency | 1 (M7) | 3 (m2, m7, m12) |
| Other | 0 | 2 (m13, m20) |
| **Total** | **8** | **20** |

### Priority Recommendations

1. **M4** (subscription activation without ownership check) -- security fix, deploy immediately
2. **M5** (silent webhook drops) -- revenue loss, fix ASAP
3. **M6** (rate limiting without Redis) -- ensure Redis is configured in production
4. **M1** (stale closure in sendToApi) -- most impactful chat logic bug
5. **m2** (pricing display vs actual limit mismatch) -- customer trust issue
6. **M2** (recursive sendToApi) -- add retry limit
7. **m7** (incomplete account deletion) -- GDPR compliance
