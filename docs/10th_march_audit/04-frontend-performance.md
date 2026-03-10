# Frontend Performance Review

## Summary

Well-structured React 19 + Next.js 16 app with good use of `memo`, `useShallow`, dynamic imports, and `content-visibility: auto`. One real re-render hotspot: ChatPage subscribes to the entire messages array, triggering cascading prop-checks on every AI bubble. The `sendToApi` closure recreation and `useTypingSimulation` cleanup are optimization targets but not launch blockers. No critical performance issues found.

---

## Findings

### [MEDIUM] ChatPage Subscribes to Entire Messages Array

**File:** `src/app/chat/page.tsx` (line 49-85)

**Issue:** ChatPage uses `useShallow` to subscribe to `messages: s.messages`. Every `addMessage` call (every AI bubble during sequencing) changes the reference, re-rendering ChatPage. This cascades memo boundary checks on ~8 children. During a 3-message AI burst: 3+ full ChatPage renders → React checks all children props → MessageList re-renders → all message items prop-checked via custom comparator.

**Impact:** On conversations with 80+ messages, reconciliation cost is measurable during the core chat loop. Memo boundaries do their job (no wasted child renders), but the checking cost adds up on low-end devices.

**Recommendation:** Create a thin `<MessageListConnected />` that subscribes to `messages` directly from the store. ChatPage subscribes only to state it uses in its own render body (activeGang, userId, chatMode, etc.).

---

### [MEDIUM] `sendToApi` Recreated Every Render

**File:** `src/hooks/use-chat-api.ts`

**Issue:** ~400-line async function recreated on every render because it closes over props directly. The ref indirection (`sendToApiRef.current = sendToApi`) makes this functionally safe — no stale closures in consumers. But the large closure is re-allocated on every state change during fast typing or AI sequencing.

**Impact:** Adds GC pressure on low-end mobile devices. Not measurable on modern hardware without profiling.

**Recommendation:** Move captured props into refs (like the existing `autoLowCostModeRef` pattern). Wrap `sendToApi` in `useCallback([])`. Optimize when touching this code.

---

### [MEDIUM] `useTypingSimulation` Relies on Consumer for Cleanup

**File:** `src/hooks/use-typing-simulation.ts`

**Issue:** Hook creates timers in refs (`typingFlushRef`, `fastModeTimerRef`, `statusTimersRef`) but has no internal cleanup `useEffect`. Relies on ChatPage to manually clear them. Fragile if the hook is ever used in a different context.

Note: `statusTimersRef` is bounded by character IDs (max 6 entries) — not an unbounded memory leak.

**Recommendation:** Add internal cleanup `useEffect` so the hook is self-contained.

---

### [LOW] `seenByMessageId` Recomputed on Every Messages Change

**File:** `src/components/chat/message-list.tsx` (lines 187-207)

**Issue:** Map recomputed when `messages` changes. With the 20-message cap, computation is cheap (~microseconds). The custom memo comparator in `MessageItem` handles the new Map reference correctly.

**No action needed.** Well-handled.

---

### [LOW] AuthManager Uses 10 Separate Store Subscriptions for Setters

**File:** `src/components/orchestrator/auth-manager.tsx` (lines 14-22)

**Issue:** 10 separate `useChatStore((s) => s.setX)` calls. All are stable function references — never trigger re-renders. AuthManager renders `null`.

**Recommendation:** Use `useChatStore.getState()` in the effect body instead. Style improvement only.

---

### [LOW] Landing Page LiveDemoCard Timer Runs When Tab Hidden

**File:** `src/components/landing/landing-page.tsx` (lines 648-680)

**Issue:** Recursive setTimeout chain runs even when tab is backgrounded. Only 1 card mounted at a time, timers are infrequent (1.8-3.5s).

**Recommendation:** Pause when `document.visibilityState !== 'visible'`. Minor.

---

### [LOW] First Screenshot Delayed by Dynamic Import

**File:** `src/app/chat/page.tsx` (lines 398-471)

**Issue:** `html-to-image` dynamically imported at call time. First screenshot downloads the library (500ms-2s). Subsequent screenshots instant.

**Recommendation:** Preload on idle: `requestIdleCallback(() => import('html-to-image'))`.

---

## What's Done Well

1. **Zustand selector patterns** — `useShallow` used correctly, individual scalar selectors where appropriate
2. **memo boundaries** — MessageList, MessageItem, ChatInput, ChatHeader all wrapped with custom comparators
3. **Dynamic imports** — MemoryVault, ChatSettings, PaywallPopup, ConfettiCelebration, all modal components lazy-loaded
4. **framer-motion tree-shaking** — `LazyMotion` + `domAnimation` + `m` pattern, `optimizePackageImports` configured
5. **content-visibility: auto** — applied to off-screen messages, last 6 always fully rendered
6. **Typing indicator batching** — 120ms debounce on typing state updates
7. **O(1) message deduplication** — module-level `_messageIdSet` in chat store
8. **Adaptive polling** — 12s active, 30s idle, pauses when tab hidden
9. **AbortController** — properly aborts in-flight fetches, handles AbortError gracefully
10. **Low-end device detection** — `BackgroundBlobs` checks `deviceMemory` and `hardwareConcurrency`
11. **Scroll position preservation** — adjusts scrollTop on history prepend
12. **Persisted store with partialize** — only persists necessary UI state, excludes transient state and `subscriptionTier`
