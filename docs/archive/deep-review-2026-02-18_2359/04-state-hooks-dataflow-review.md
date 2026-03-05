# State Management, Hooks & Data Flow Deep Review

**Reviewed:** 2026-02-18
**Reviewer:** Senior React/Frontend Architect
**Scope:** Zustand store, all custom hooks, orchestrator components, chat page

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [File-by-File Analysis](#file-by-file-analysis)
   - [chat-store.ts](#1-srcstoreschat-storets)
   - [use-chat-history.ts](#2-srchooksuse-chat-historyts)
   - [use-chat-api.ts](#3-srchooksuse-chat-apits)
   - [use-typing-simulation.ts](#4-srchooksuse-typing-simulationts)
   - [use-capacity-manager.ts](#5-srchooksuse-capacity-managerts)
   - [use-autonomous-flow.ts](#6-srchooksuse-autonomous-flowts)
   - [chat-utils.ts](#7-srclibchat-utilsts)
   - [client-journey.ts](#8-srclibsupabaseclient-journeyts)
   - [squad-reconcile.tsx](#9-srccomponentsorchestatorsquad-reconciletsx)
   - [perf-monitor.tsx](#10-srccomponentsorchestatorperf-monitortsx)
   - [error-boundary.tsx](#11-srccomponentsorchestatorerror-boundarytsx)
   - [chat/page.tsx](#12-srcappchatpagetsx)
3. [Cross-Cutting Concerns](#cross-cutting-concerns)
4. [Prioritized Improvements](#prioritized-improvements)

---

## Executive Summary

The codebase shows a **competent, pragmatic architecture** for a real-time chat app with AI characters. The Zustand store is well-structured with persistence, the hook decomposition keeps the chat page manageable, and there is genuine attention to edge cases (stale delivery statuses, duplicate messages, capacity backoff). That said, the ref-patching bridge pattern between `useChatApi` and `useAutonomousFlow` is the single biggest architectural risk -- it creates a temporal coupling that is fragile and hard to reason about. There are also several stale closure hazards, missing cleanup paths, and re-render inefficiencies that could cause subtle bugs under load.

**Critical issues:** 3
**Major issues:** 8
**Minor issues:** 12
**Good patterns worth preserving:** 10+

---

## File-by-File Analysis

### 1. `src/stores/chat-store.ts`

#### STATE MANAGEMENT

**Good:**
- `partialize` on line 135-147 correctly excludes transient state (`characterStatuses`, `isHydrated`, `squadConflict`) from persistence. Well thought out.
- The `MAX_PERSISTED_MESSAGES = 600` cap (line 5) with slicing in `setMessages` (line 99) and `addMessage` (line 106) prevents unbounded localStorage growth.
- The `_messageIdSet` module-level Set (line 68) for O(1) duplicate detection on `addMessage` is a smart hot-path optimization.

**Buggy/Risky:**
- **Lines 148-163 -- `onRehydrateStorage` mutates state.messages in place.** The loop on line 152-157 mutates `m.deliveryStatus` and `m.deliveryError` directly on the rehydrated message objects. While line 161 creates a new array reference `[...state.messages]`, the individual objects are still the same mutated references. This works in practice because Zustand uses shallow comparison, but it violates immutability conventions and could cause issues if any downstream consumer memoizes on individual message object identity.
- **Line 68 -- `_messageIdSet` is a module-level mutable singleton.** This is intentionally outside the store for performance, but it creates an invisible coupling. If the store is ever reset (e.g., during tests or SSR) without calling `clearChat()`, the set becomes stale. There is no mechanism to sync it if `setMessages` is called from rehydration before `rebuildIdSet` finishes.
- **Line 103-111 -- `addMessage` creates a new array on every call.** The spread `[...state.messages, message]` plus `.slice()` allocates a new array each time. For rapid sequential AI events (the sequencer in `use-chat-api.ts` fires multiple `addMessage` calls in a tight loop), this causes N array allocations for N events. Consider batching.

**Missing Selectors:**
- No derived selectors for common queries like "last user message", "message count", "has user messages". Multiple consumers recompute these inline (e.g., `messages.some(m => m.speaker === 'user')` appears in at least 3 files).
- Every consumer that calls `useChatStore()` without `useShallow` gets the entire state object and re-renders on ANY state change. Line 98 in `use-chat-api.ts` (`const { addMessage, setMessages, ... } = useChatStore()`) selects only actions, but because it uses the default selector, it still subscribes to the full state.

**Improvements:**
1. Add derived selectors: `useMessages()`, `useActiveGang()`, `useLastUserMessage()`.
2. Consider batching `addMessage` with `useChatStore.setState` for the sequencer path.
3. Wrap `onRehydrateStorage` mutations in proper immutable updates.

---

### 2. `src/hooks/use-chat-history.ts`

#### HOOKS QUALITY

**Good:**
- **Lines 243-269 -- Bootstrap effect has proper `cancelled` flag.** Textbook cleanup for async effects. This prevents state updates after unmount.
- **Line 275 -- `historySyncInFlightRef` guard** prevents concurrent sync calls. Solid.
- **Lines 291 -- `useChatStore.getState()` inside the callback** avoids stale closure over `messages`. This is the correct pattern for reading latest state in async callbacks.
- **Lines 136-187 -- `reconcileMessagesFromHistory`** is a sophisticated merge algorithm that handles ID mismatches, signature-based fuzzy matching, and timestamp proximity. This is impressively robust.

**Buggy/Risky:**
- **Line 208 -- `const { messages, setMessages } = useChatStore()`** subscribes to the ENTIRE store. Every time `characterStatuses`, `chatMode`, `lowCostMode`, or any other field changes, this hook re-runs all its effects. Should use `useShallow` or individual selectors.
- **Line 230 -- `messages.length` in dependency array of the quick-set effect.** Because `messages` is subscribed to via the full store selector on line 208, this effect fires on every message add/remove. The effect on lines 221-234 does `setHistoryStatus('has_history')` repeatedly, which is technically idempotent but causes unnecessary state batches.
- **Line 270 -- Bootstrap effect depends on `messages.length`.** If the bootstrap fetches messages and calls `setMessages` (line 249), this changes `messages.length`, which could re-trigger this effect. The `historyBootstrapDone` guard on line 239 prevents an infinite loop, but the dependency chain is fragile -- if someone removes that guard, the effect would loop.
- **Lines 315 -- `syncLatestHistory` callback depends on `isBootstrappingHistory` and `isLoadingOlderHistory`.** These are state values that change during async operations, causing the callback to be recreated frequently. Since `syncLatestHistory` is used in the interval effect (line 321), each recreation clears and re-sets the interval, causing sync timing jitter.

**RACE CONDITIONS:**
- **Lines 286-314 -- `syncLatestHistory` reads `useChatStore.getState().messages` on line 291 and then calls `setMessages` on line 308.** Between the read and the write, the user could send a message (via `addMessage`), and the reconciled result would overwrite it. The `pendingUserMessagesRef` guard on line 280 mitigates this for the common case, but there is a window between the guard check and the `setMessages` call where a new message could arrive.

**DATA FLOW:**
- The `collapseLikelyDuplicateMessages` function is exported and used both internally and by the hook. This is good separation.
- The `shouldPreserveLocalMessage` function (line 86-92) uses a 15-minute window (line 89) and a 5-second tolerance (line 91). These magic numbers should be constants.

---

### 3. `src/hooks/use-chat-api.ts`

#### HOOKS QUALITY

**Critical -- this is not a proper hook. It is a closure factory.**

- **Lines 158-421 -- `sendToApi` is defined as a plain `async function` inside the hook body**, not wrapped in `useCallback`. It captures `lowCostMode`, `chatMode`, `activeGang`, `userName`, `userNickname`, `isGuest`, and `messages` from the hook's closure scope. Every render creates a NEW `sendToApi` function. Line 422 patches it to `sendToApiRef.current`, which means consumers reading the ref always get the latest, but the function itself closes over potentially stale values.
- **Line 159 -- `lowCostMode` is read from closure.** If the user toggles low-cost mode WHILE `sendToApi` is awaiting the fetch, the in-flight call still uses the old value. This is acceptable but should be documented.
- **Line 506 -- `handleSend` reads `messages.length` from closure** to determine `isIntro`/`isAutonomous`. This is a stale closure risk -- if `handleSend` is called from a memoized child, the `messages` reference could be outdated. However, `handleSendRef.current` is patched on line 519, and consumers use the ref, so in practice the latest closure is always used.

**Buggy/Risky:**
- **Line 261 -- Dead code: `if (!res)` after `res = await fetch(...)`.** If `fetch` throws, execution jumps to the catch block. If it succeeds, `res` is never null. This check is unreachable.
- **Lines 323-383 -- The sequencer `for...of` loop with `await`** blocks the main thread conceptually (though not literally, since each `await` yields). If the user sends a message during the loop, `pendingUserMessagesRef.current` is checked at the top of each iteration (lines 324, 331, 342). However, between the check on line 331 and the `addMessage` on line 344, there is a gap where the user could type. The `break` on line 342 only fires AFTER the typing delay, which could be ~2 seconds.
- **Lines 388-395 -- Autonomous continuation calls `sendToApi` recursively** after setting `isGeneratingRef.current = false` on line 391. This means `isGeneratingRef` is briefly false between the current call ending and the recursive call starting. During this window, `syncLatestHistory` could fire and overwrite messages.
- **Line 436 -- `scheduleDebouncedSend` calls `sendToApi` without `.catch()`.** The returned promise is ignored (no `void` annotation). If `sendToApi` throws, the rejection is unhandled.

**PERFORMANCE:**
- **Line 98 -- `useChatStore()` without selector** subscribes to the full store. The hook extracts `addMessage`, `setMessages`, `setCharacterStatus`, `setUserNickname` -- all functions that never change. This should use a stable selector or direct `useChatStore.getState()`.
- **Lines 100-122 -- 16 useRef declarations.** This is a code smell indicating the hook is doing too much. Consider splitting into sub-hooks or a reducer pattern.

**ERROR HANDLING:**
- **Line 247-251 -- `res.json()` is wrapped in try/catch**, which is good. But `data` could be null on line 308 if JSON parsing failed, and the `!data?.events` check throws `'Invalid response shape'` which is caught by the outer try/catch. The error message could be more descriptive.
- **Line 398-400 -- Generic catch** logs to console and shows a toast. No retry logic for transient network errors (except for the capacity backoff path). Consider exponential backoff for 5xx errors.

---

### 4. `src/hooks/use-typing-simulation.ts`

#### HOOKS QUALITY

**Good:**
- **Lines 18-19 -- Dual tracking with ref + state.** The `typingUsersRef` Set is the source of truth for synchronous reads, and `typingUsers` state drives renders. The `scheduleTypingFlush` pattern (lines 29-32) batches rapid typing updates into a single render. This is a well-executed optimization.
- **Lines 53-71 -- `bumpFastMode`** uses a streak counter with time decay. Clean implementation.

**Buggy/Risky:**
- **Lines 24-27 -- `flushTypingUsers` is NOT wrapped in `useCallback`.** It captures `setTypingUsers` from useState which is stable, so it technically works, but `scheduleTypingFlush` on line 29 also is not wrapped. If this hook ever re-renders for other reasons, new function references are created, though since they are only used internally via refs, this is low-risk.
- **Lines 73-76 -- `pickStatusFor` always returns a random status** regardless of the character. The `characterId` parameter is checked for truthiness but never used to select a character-specific status. This seems intentional (random ambient statuses) but the function name implies character-specific behavior.
- **Lines 90-98 -- `triggerActivityPulse` calls `useChatStore.getState()`** directly which is correct for avoiding stale closures, but creates a hidden dependency on the store.

**MEMORY LEAKS:**
- **Line 84 -- `statusTimersRef.current[characterId] = setTimeout(...)`.** Timers are stored in a ref but only cleared individually when a new pulse fires for the same character. If the component unmounts while timers are pending, they fire on unmounted state. The cleanup in `page.tsx` line 182-184 handles this, but only by iterating `Object.values` of the ref captured at mount time -- any timers added AFTER mount but BEFORE unmount could be missed if the ref object is replaced (it is not in this case, but the pattern is fragile).

---

### 5. `src/hooks/use-capacity-manager.ts`

#### HOOKS QUALITY

**Good:**
- **Lines 24-26 -- Ref sync pattern.** Keeping `autoLowCostModeRef` in sync with `autoLowCostMode` state via a useEffect is a standard pattern for making state readable in callbacks without stale closures. Well executed.
- **Lines 38-63 -- `recordCapacityError`** implements a sliding window algorithm with both a 2-minute stress window and a 5-minute hard window. The dual-threshold approach (2 errors in 2min OR 4 errors in 5min) is thoughtful.
- **Lines 66-83 -- Recovery logic** requires 10 successful user turns before disabling auto low-cost mode. This prevents flapping.

**Buggy/Risky:**
- **Lines 29-36 -- Effect resets auto mode when manual `lowCostMode` changes.** The dependency is `[lowCostMode]`. If the user toggles lowCostMode off (false), the effect runs but the guard `if (!lowCostMode) return` exits early. This means auto mode is only reset when `lowCostMode` becomes true. This is correct behavior but the comment on line 29 is misleading -- it says "if user manually enables" but the code literally only runs when lowCostMode is truthy.
- **`recordCapacityError` and `recordSuccessfulUserTurn` are not wrapped in `useCallback`.** They are passed as props to `useChatApi`, which means every re-render of the parent creates new function references. Since `useChatApi` doesn't depend on these in any dependency arrays (they are called imperatively), this is harmless but wasteful.

**STATE MANAGEMENT:**
- The dual state+ref pattern (`autoLowCostMode` state + `autoLowCostModeRef` ref) is used correctly but adds complexity. Consider whether the state is needed at all -- the only consumer of `autoLowCostMode` (non-ref) is `ChatHeader` via `capacity.autoLowCostMode` on page.tsx line 341. If that could read from a ref, the state could be eliminated.

---

### 6. `src/hooks/use-autonomous-flow.ts`

#### HOOKS QUALITY

**Good:**
- **Line 65 -- `useShallow` selector** is used correctly to prevent unnecessary re-renders. Only the 5 fields needed are selected.
- **Lines 90-99 -- `canRunIdleAutonomous`** centralizes all precondition checks for autonomous flow. Clean.
- **Lines 127-162 -- `triggerLocalGreeting`** is a well-structured cascade of timed events with proper guards (`hasUserMessage` checks before each step).

**Buggy/Risky:**
- **Lines 167-198 -- Resume autonomous effect.** This effect depends on `messages` (the full array reference from useShallow). Every time any message is added or removed, this effect re-runs. The `resumeAutonomousTriggeredRef.current` guard on line 170 prevents re-execution after the first run, but the effect is still invoked on every message change, performing the ref check and returning early. This is wasteful for a one-shot effect. Consider splitting into a separate `useEffect` with a stable dependency.
- **Line 182 -- `[...messages].reverse().find(...)` on every effect run.** This creates a full copy of the messages array just to find the last user message. Use `findLast()` or iterate backwards manually.
- **Line 162 -- `triggerLocalGreeting` depends on `pickStatusFor` and `pulseStatus`.** These functions are NOT memoized in `useTypingSimulation` (they are plain functions inside the hook body). Every render of the parent creates new references, which would invalidate this `useCallback`. However, since `triggerLocalGreetingRef.current` is used for invocation (not the callback itself), the stale reference is mitigated. The dependency array is technically incorrect though -- React's exhaustive-deps rule would flag this, and if the deps were removed, the closure would be stale.

**RACE CONDITIONS:**
- **Lines 108-124 -- `scheduleIdleAutonomous` timer callback** reads from multiple refs and the store. Between scheduling and firing (10 seconds), any of these could have changed. The guards inside the callback (lines 111-115) catch most cases, but there is a window where `canRunIdleAutonomous()` returns true at check time but the autonomous call fails because conditions changed by the time `sendToApiRef.current` executes.

**DATA FLOW:**
- **Lines 76, 164 -- `triggerLocalGreetingRef` is declared locally AND returned.** The parent page patches `api.triggerLocalGreetingRef.current = autonomous.triggerLocalGreeting` on page.tsx line 128. This double-ref pattern (one in autonomous, one in api) for the same function is confusing and error-prone.

---

### 7. `src/lib/chat-utils.ts`

#### QUALITY

**Good:**
- Small, focused utility module with pure functions. No side effects.
- `sanitizeMessageId` (line 3-6) properly handles non-string input and enforces a max length.
- `isMissingHistoryMetadataColumnsError` (line 8-15) is a defensive check for schema migration issues.

**Minor Issues:**
- **Line 1 -- `MAX_MESSAGE_ID_CHARS = 128`.** This constant should probably live in a shared constants file since message IDs are generated in multiple places (`use-chat-api.ts` line 345, `use-autonomous-flow.ts` line 153, etc.) and none of them enforce this limit at creation time.
- The module is very small (16 lines). Consider whether these utilities belong in a larger chat utilities module or if the current granularity is intentional.

---

### 8. `src/lib/supabase/client-journey.ts`

#### DATA FLOW

**Good:**
- **Lines 20-53 -- `fetchJourneyState`** has a sensible fallback chain: gang members -> preferred_squad -> empty. The `slice(0, 4)` on line 51 enforces a max gang size.
- **Lines 55-99 -- `persistUserJourney`** validates input before persisting (username trimming, gang size bounds).

**Buggy/Risky:**
- **Lines 21-25 -- No error handling on the profile fetch.** If the Supabase query fails, `profile` is undefined and `data` destructuring silently returns null. The caller gets `{ profile: null, gangIds: [] }` with no indication that a network error occurred vs. a genuinely empty profile.
- **Lines 88-98 -- Delete-then-insert pattern for gang members** is not atomic. If the `insert` on line 98 fails after the `delete` on line 96 succeeds, the user loses their gang members with no recovery. This should be wrapped in a database transaction or use an upsert pattern.
- **Lines 28-33 -- Two sequential Supabase calls** (profile fetch, then gang fetch) could be parallelized with `Promise.all` since they are independent.
- **Line 80-85 -- Profile update has no error handling.** The `await supabase.from('profiles').update(...)` result is not checked. A failure here would be silent.

**PERFORMANCE:**
- Three sequential network calls in `fetchJourneyState` (profile, gang, members) could be reduced to two with a join or parallelized.

---

### 9. `src/components/orchestrator/squad-reconcile.tsx`

#### HOOKS QUALITY

**Good:**
- Simple, focused component with clear responsibility.
- **Line 47 -- Dialog `onOpenChange`** properly handles dismissal.

**Buggy/Risky:**
- **Lines 28-37 -- `handleUseLocal` has no error handling in the try block.** If `saveGang` throws, the `finally` block runs `onResolve()`, which clears the conflict state. The user sees the dialog close but their local gang was not saved to the cloud. The error is swallowed silently.
- **Line 21 -- `useChatStore()` without selector** subscribes to the entire store. Only `setActiveGang` is needed. Since this is a lazy-loaded dialog that renders rarely, the impact is low, but it is still technically incorrect.

---

### 10. `src/components/orchestrator/perf-monitor.tsx`

#### HOOKS QUALITY

**Good:**
- **Lines 71-76 -- Cleanup function** properly disconnects all PerformanceObservers. Well done.
- **Lines 11-12 -- Early exit** for non-production and non-opted-in users prevents unnecessary observer setup.
- Renders nothing (`return null` on line 83). Zero visual footprint.

**Buggy/Risky:**
- **Lines 71-76 -- Cleanup only runs if the `PerformanceObserver` branch is entered.** If the `try` on line 23 (navigation timing) throws and the `PerformanceObserver` branch on line 34 is not entered, the `useEffect` returns `undefined` (no cleanup). This is fine because no observers were created, but the code structure could be clearer with the cleanup always returned.
- **Lines 52-60 -- CLS observer fires `sendMetric` on every layout shift entry batch.** This could generate a high volume of analytics events on pages with frequent layout shifts. Consider debouncing or only reporting the final CLS value on page hide.

---

### 11. `src/components/orchestrator/error-boundary.tsx`

#### ERROR HANDLING

**Good:**
- Proper class component implementation for error boundaries (React requires this).
- **Line 24 -- `componentDidCatch`** logs the error with error info.
- Recovery UI is user-friendly with a reload button.

**Missing:**
- **No error reporting to an external service.** Line 25 only logs to console. In production, errors caught here should be sent to Sentry, LogRocket, or similar.
- **No state reset mechanism.** The only recovery is a full page reload (line 38). Consider adding a "try again" button that resets the error state (`this.setState({ hasError: false })`) which would attempt to re-render the children.
- **No error context.** The boundary does not capture or display which component failed. Adding a `fallback` prop or `errorInfo.componentStack` display (in dev mode) would help debugging.
- **Line 7 -- Props interface has no `fallback` prop.** Consider adding an optional fallback render prop for different error UIs in different contexts.

---

### 12. `src/app/chat/page.tsx`

#### STATE MANAGEMENT

**Good:**
- **Lines 45-59 -- `useShallow` selector** correctly prevents unnecessary re-renders by selecting only needed fields. This is the right pattern.
- **Lines 7-9 -- Dynamic imports** for AuthWall, MemoryVault, ChatSettings, and SquadReconcile reduce initial bundle size. Well done.
- **Lines 146-155 -- `replyingToDisplay` is memoized** with `useMemo` on the right dependencies.

**Buggy/Risky:**
- **Lines 126-128 -- Ref patching is done in the render phase.** These three lines execute on EVERY render:
  ```
  api.clearIdleAutonomousTimerRef.current = autonomous.clearIdleAutonomousTimer
  api.scheduleIdleAutonomousRef.current = autonomous.scheduleIdleAutonomous
  api.triggerLocalGreetingRef.current = autonomous.triggerLocalGreeting
  ```
  This is the "bridge pattern" between `useChatApi` and `useAutonomousFlow`. It works because refs are synchronously available before any async code reads them, but it has several problems:
  1. **Violates React's render purity principle.** Setting refs during render is a side effect. In React 18+ with concurrent features (or future StrictMode double-rendering), this could cause issues.
  2. **Temporal coupling.** `useChatApi` must be called BEFORE `useAutonomousFlow`, and the patching must happen AFTER both. If hook ordering changes, the bridge breaks silently.
  3. **Invisible dependencies.** There is no TypeScript or runtime enforcement that the patching happened. If someone removes line 127, `scheduleIdleAutonomousRef.current` is the no-op from line 120 of use-chat-api.ts forever.

- **Line 187 -- Cleanup effect has empty dependency array** but references `autonomous.greetingTimersRef.current` and `typing.statusTimersRef.current` captured at mount time. If these ref containers are replaced (they are not in current code, but could be in future refactors), cleanup would clear stale timers.

- **Lines 84-106 -- `useChatApi` receives `messages` as a prop (line 91).** This is the `messages` array from the store via `useShallow`. Every time a message is added, `messages` reference changes, `ChatPage` re-renders, and `useChatApi` receives a new `messages` prop. However, `useChatApi` only uses `messages` in `handleSend` (line 506) to check `messages.length`. This means the entire API hook is reconstructed on every message change. The hook should read `messages.length` from the store directly.

- **Lines 335-343 -- `ChatHeader` receives `tokenUsage={api.lastTokenUsageRef.current}`.** Reading a ref's `.current` during render means the value is whatever it was at render time. If `lastTokenUsageRef` updates between renders (e.g., during the sequencer), the header will not re-render to show the new value. This is likely intentional (to avoid re-renders) but means token usage display could be stale.

#### PERFORMANCE

- **Lines 330-331 -- `BackgroundBlobs` receives `isMuted={typing.typingUsers.length > 0}`.** The `typingUsers` array changes frequently during AI response sequences. If `BackgroundBlobs` is not memoized internally, it re-renders on every typing state change.
- **Lines 355-365 -- `MessageList` receives `messages` directly.** Every new message causes a full re-render of the message list. The list should use virtualization for 600+ messages.

#### DATA FLOW

- **Line 72 -- `sessionRef` is declared in both `page.tsx` (line 72) and `use-chat-api.ts` (line 112).** Two separate session refs tracking the same concept. The one in `use-chat-api.ts` is set on line 478 during message send; the one in `page.tsx` is set on line 168 during initial analytics. They could diverge if the analytics session rotates.

---

## Cross-Cutting Concerns

### The Ref-Bridge Anti-Pattern (Critical)

The biggest architectural concern across the codebase is the ref-bridge pattern between `useChatApi` and `useAutonomousFlow`. The dependency graph is:

```
useChatApi creates refs: autonomousBackoffUntilRef, clearIdleAutonomousTimerRef,
                         scheduleIdleAutonomousRef, triggerLocalGreetingRef

useAutonomousFlow reads: isGeneratingRef, pendingUserMessagesRef, sendToApiRef,
                         lastUserMessageIdRef, autonomousBackoffUntilRef, etc.

page.tsx patches: api.clearIdleAutonomousTimerRef.current = autonomous.clearIdleAutonomousTimer
                  api.scheduleIdleAutonomousRef.current = autonomous.scheduleIdleAutonomous
                  api.triggerLocalGreetingRef.current = autonomous.triggerLocalGreeting
```

This creates a circular dependency resolved via mutation timing. If `sendToApi` fires BEFORE the patch on page.tsx line 127 runs (e.g., due to a useEffect in one of the hooks), `scheduleIdleAutonomousRef.current` is the no-op from initialization.

**Recommendation:** Extract a shared context or a mediator object that both hooks receive. Or combine the two hooks into one larger hook with clear internal organization.

### Stale Closures vs. Ref Reads

The codebase uses two patterns for reading current state:
1. **Closure capture** (e.g., `messages` in `handleSend` on use-chat-api.ts line 506)
2. **`useChatStore.getState()`** (e.g., line 191 in `sendToApi`, line 291 in `syncLatestHistory`)

Pattern 2 is correct for async callbacks. Pattern 1 is used in some synchronous paths and some async paths inconsistently. Notably:
- `handleSend` uses closure `messages.length` (stale risk)
- `sendToApi` uses `useChatStore.getState().messages` (correct)
- `enqueueUserMessage` uses `useChatStore.getState().messages` (correct)

The inconsistency suggests the stale closure risks were discovered and fixed ad hoc rather than addressed systematically.

### Message Deduplication -- Three Layers

Messages are deduplicated in three separate places:
1. **`_messageIdSet`** in `chat-store.ts` (line 104) -- Set-based, ID only
2. **`setMessages` dedup loop** in `chat-store.ts` (lines 92-98) -- linear scan, ID only
3. **`collapseLikelyDuplicateMessages`** in `use-chat-history.ts` (lines 94-134) -- signature + timestamp based

This layered approach is defensive but means the dedup logic is spread across files and uses different strategies. A message could pass layer 1 (different ID) but be collapsed by layer 3 (same signature). This is intentional for handling the local-ID vs. server-ID mismatch, but the three layers should be documented together.

### Missing Global Error Boundary

The `ErrorBoundary` component on page.tsx line 354 only wraps `MessageList`. If `ChatHeader`, `ChatInput`, or any of the hooks throw during render, the entire page crashes with no recovery UI. Consider wrapping the entire `<main>` element in an ErrorBoundary.

---

## Prioritized Improvements

### P0 -- Critical (Fix ASAP)

1. **Eliminate ref-bridge pattern between useChatApi and useAutonomousFlow.** Extract a shared coordinator (mediator pattern, combined hook, or context). The current pattern will cause bugs when React concurrent features are used or during StrictMode double-rendering. Files: `use-chat-api.ts`, `use-autonomous-flow.ts`, `page.tsx`.

2. **Add error handling to `persistUserJourney` delete-then-insert.** Wrap the gang member delete+insert in a Supabase RPC transaction or at minimum catch the insert error and re-insert the old members. File: `client-journey.ts` lines 96-98.

3. **Fix `handleUseLocal` silent error swallowing in SquadReconcile.** Add a catch block that shows an error toast and does NOT call `onResolve()`. File: `squad-reconcile.tsx` lines 28-37.

### P1 -- Major (Fix Soon)

4. **Add `useShallow` selectors to all store consumers.** Affected files:
   - `use-chat-history.ts` line 208 -- subscribes to full store
   - `use-chat-api.ts` line 98 -- subscribes to full store (only needs actions)
   - `use-typing-simulation.ts` line 13 -- subscribes to full store (only needs `setCharacterStatus`)
   - `squad-reconcile.tsx` line 21 -- subscribes to full store

5. **Remove `messages` from `useChatApi` props.** The hook only uses `messages.length` in `handleSend` to determine isIntro/isAutonomous. Read this from the store directly via `useChatStore.getState().messages.length`. This eliminates a re-render of the entire API hook on every message change. File: `use-chat-api.ts`, `page.tsx` line 91.

6. **Add external error reporting to ErrorBoundary.** Send errors to a monitoring service in `componentDidCatch`. File: `error-boundary.tsx` line 24.

7. **Parallelize Supabase calls in `fetchJourneyState`.** Use `Promise.all` for the profile and gang queries. File: `client-journey.ts` lines 21-43.

8. **Fix `syncLatestHistory` dependency array causing interval recreation.** Move `isBootstrappingHistory` and `isLoadingOlderHistory` into refs, or check them inside the callback via store state. File: `use-chat-history.ts` line 315.

### P2 -- Minor (Improve When Touching)

9. **Extract magic numbers into named constants.** Affected values:
   - `15_000` ms duplicate window in `use-chat-history.ts` lines 119, 169
   - `15 * 60 * 1000` ms preservation window in `use-chat-history.ts` line 89
   - `600` ms debounce in `use-chat-api.ts` line 437
   - `1600` ms minimum gap in `use-chat-api.ts` line 232
   - `10_000` ms idle delay in `use-autonomous-flow.ts` line 107
   - `12000` ms sync interval in `use-chat-history.ts` line 322
   - `8000` ms sync throttle in `use-chat-history.ts` line 281

10. **Add derived selectors to the store.** Create `useMessages()`, `useHasUserMessages()`, `useLastUserMessage()` to eliminate repeated inline computations.

11. **Wrap non-memoized callbacks in useCallback.** `pickStatusFor`, `pulseStatus`, `triggerActivityPulse`, `triggerReadingStatuses` in `use-typing-simulation.ts` are recreated every render. Memoize them or move to refs.

12. **Remove dead code.** `use-chat-api.ts` line 261 (`if (!res)`) is unreachable.

13. **Add `findLast` usage in `use-autonomous-flow.ts` line 182** instead of `[...messages].reverse().find(...)`.

14. **Debounce CLS reporting in perf-monitor.tsx** lines 52-60 to reduce analytics event volume.

15. **Add a "try again" recovery button to ErrorBoundary** that resets error state instead of requiring a full page reload.

16. **Add error handling for Supabase queries in `fetchJourneyState`** and `persistUserJourney`. Currently all query errors are silently swallowed.

17. **Consolidate duplicate `sessionRef`** declarations between `page.tsx` line 72 and `use-chat-api.ts` line 112.

18. **Consider message list virtualization** for the 600-message cap. At MAX_PERSISTED_MESSAGES, rendering all messages causes significant DOM overhead.

19. **Wrap the entire chat page in an ErrorBoundary**, not just MessageList.

20. **Add JSDoc comments to the reconciliation functions** in `use-chat-history.ts` (lines 41-84, 86-92, 136-187) documenting the merge algorithm, since the logic is complex and critical.
